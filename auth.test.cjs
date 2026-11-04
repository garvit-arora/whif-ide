/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('Google OAuth validates browser state, signatures, sessions, replay and logout origin', async () => {
	const oldId = process.env.GOOGLE_CLIENT_ID, oldSecret = process.env.GOOGLE_CLIENT_SECRET, oldOrigin = process.env.PUBLIC_ORIGIN;
	process.env.GOOGLE_CLIENT_ID = 'test-client'; process.env.GOOGLE_CLIENT_SECRET = 'test-only-secret'; process.env.PUBLIC_ORIGIN = 'http://127.0.0.1:4173';
	const originalFetch = global.fetch;
	const { handleAuth } = require('./auth.cjs');
	const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
	const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig' };
	let nonce;
	let invalidSignature = false;
	const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');
	global.fetch = async url => {
		if (url.endsWith('/certs')) { return { ok: true, json: async () => ({ keys: [jwk] }) }; }
		assert.equal(url, 'https://oauth2.googleapis.com/token');
		const content = `${encode({ alg: 'RS256', kid: 'test-key' })}.${encode({ iss: 'https://accounts.google.com', aud: 'test-client', sub: 'test-user', email: 'test@example.com', email_verified: true, name: 'Test User', nonce, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
		const signature = invalidSignature ? Buffer.from('invalid') : crypto.sign('RSA-SHA256', Buffer.from(content), privateKey);
		return { ok: true, json: async () => ({ id_token: `${content}.${signature.toString('base64url')}` }) };
	};
	async function request(url, headers = {}, method = 'GET') {
		const result = { headers: {}, code: 0, body: '' };
		const response = { setHeader: (key, value) => { result.headers[key.toLowerCase()] = value; }, writeHead: (code, values) => { result.code = code; for (const [key, value] of Object.entries(values || {})) { result.headers[key.toLowerCase()] = value; } }, end: body => { result.body = body || ''; } };
		await handleAuth({ url, method, headers: { host: '127.0.0.1:4173', ...headers } }, response, new URL(url, 'http://127.0.0.1:4173').pathname);
		return result;
	}
	try {
		const start = await request('/auth/google');
		assert.equal(start.code, 303);
		const redirect = new URL(start.headers.location);
		assert.equal(redirect.origin, 'https://accounts.google.com');
		assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
		nonce = redirect.searchParams.get('nonce');
		const browserCookie = start.headers['set-cookie'].split(';')[0];
		assert.match(start.headers['set-cookie'], /HttpOnly; SameSite=Lax/);
		const callback = `/auth/google/callback?code=test-code&state=${redirect.searchParams.get('state')}`;
		assert.equal((await request(callback)).headers.location, '/?auth=failed');
		const completed = await request(callback, { cookie: browserCookie });
		assert.equal(completed.headers.location, '/?auth=success');
		const sessionCookie = completed.headers['set-cookie'][1].split(';')[0];
		assert.equal(JSON.parse((await request('/api/session', { cookie: sessionCookie })).body).user.email, 'test@example.com');
		assert.equal((await request(callback, { cookie: browserCookie })).headers.location, '/?auth=failed');
		assert.equal((await request('/auth/logout', { cookie: sessionCookie, origin: 'https://attacker.example', 'x-wispr-request': 'logout' }, 'POST')).code, 403);
		assert.equal((await request('/auth/logout', { cookie: sessionCookie, origin: 'http://127.0.0.1:4173', 'x-wispr-request': 'logout' }, 'POST')).code, 200);
		assert.equal(JSON.parse((await request('/api/session', { cookie: sessionCookie })).body).user, null);
		assert.equal((await request('/api/session', { host: 'attacker.example' })).code, 403);
		const second = await request('/auth/google');
		const secondUrl = new URL(second.headers.location); nonce = secondUrl.searchParams.get('nonce'); invalidSignature = true;
		assert.equal((await request(`/auth/google/callback?code=test&state=${secondUrl.searchParams.get('state')}`, { cookie: second.headers['set-cookie'].split(';')[0] })).headers.location, '/?auth=failed');
	} finally {
		global.fetch = originalFetch;
		for (const [key, value] of [['GOOGLE_CLIENT_ID', oldId], ['GOOGLE_CLIENT_SECRET', oldSecret], ['PUBLIC_ORIGIN', oldOrigin]]) { if (value === undefined) { delete process.env[key]; } else { process.env[key] = value; } }
	}
});
