/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
'use strict';
const crypto = require('node:crypto');
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const origin = new URL(process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:4173').origin;
const secure = origin.startsWith('https:');
if (!secure && !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) { throw new Error('PUBLIC_ORIGIN must use HTTPS outside loopback.'); }
const configured = Boolean(clientId && clientSecret);
const pending = new Map();
const sessions = new Map();
const random = () => crypto.randomBytes(32).toString('base64url');
const cookies = request => Object.fromEntries((request.headers.cookie || '').split(';').map(item => item.trim().split('=')).filter(item => item.length === 2));
const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
function json(response, code, value) { response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }
function redirect(response, location) { response.writeHead(303, { Location: location, 'Cache-Control': 'no-store' }); response.end(); }
function prune() { for (const map of [pending, sessions]) { for (const [key, value] of map) { if (value.expires <= Date.now()) { map.delete(key); } } } }
async function fetchJson(url, options = {}) {
	const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
	if (!response.ok) { throw new Error('Identity provider request failed'); }
	return response.json();
}
async function verifyIdToken(token, nonce) {
	if (typeof token !== 'string') { throw new Error('Missing identity token'); }
	const parts = token.split('.');
	if (parts.length !== 3) { throw new Error('Invalid identity token'); }
	const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
	const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
	if (header.alg !== 'RS256' || typeof header.kid !== 'string') { throw new Error('Invalid signature algorithm'); }
	const jwks = await fetchJson('https://www.googleapis.com/oauth2/v3/certs');
	const jwk = jwks.keys.find(key => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig');
	if (!jwk || !crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) { throw new Error('Invalid signature'); }
	if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) || claims.aud !== clientId || claims.nonce !== nonce || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now() || typeof claims.sub !== 'string' || !claims.sub || claims.email_verified !== true || typeof claims.email !== 'string') { throw new Error('Invalid identity claims'); }
	return { id: claims.sub, name: typeof claims.name === 'string' ? claims.name : claims.email, email: claims.email };
}
async function handleAuth(request, response, pathname) {
	if (!pathname.startsWith('/auth/') && pathname !== '/api/session') { return false; }
	prune();
	const jar = cookies(request);
	if (request.headers.host !== new URL(origin).host) { json(response, 403, { error: 'Unexpected host. Open the configured PUBLIC_ORIGIN.' }); return true; }
	if (pathname === '/api/session' && request.method === 'GET') {
		const session = sessions.get(jar.wispr_session);
		json(response, 200, { configured, user: session?.user || null }); return true;
	}
	if (pathname === '/auth/logout' && request.method === 'POST') {
		if (request.headers.origin !== origin || request.headers['x-wispr-request'] !== 'logout') { json(response, 403, { error: 'Invalid origin' }); return true; }
		sessions.delete(jar.wispr_session); response.setHeader('Set-Cookie', cookie('wispr_session', '', 0)); json(response, 200, { ok: true }); return true;
	}
	if (pathname === '/auth/google' && request.method === 'GET') {
		if (!configured) { json(response, 503, { error: 'Google login is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.' }); return true; }
		if (pending.size >= 1000) { json(response, 429, { error: 'Please try again later.' }); return true; }
		pending.delete(jar.wispr_oauth);
		const browserKey = random(), state = random(), verifier = random(), nonce = random();
		pending.set(browserKey, { state, verifier, nonce, expires: Date.now() + 600000 });
		response.setHeader('Set-Cookie', cookie('wispr_oauth', browserKey, 600));
		const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
		url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${origin}/auth/google/callback`, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
		redirect(response, url.href); return true;
	}
	if (pathname === '/auth/google/callback' && request.method === 'GET') {
		const attempt = pending.get(jar.wispr_oauth);
		pending.delete(jar.wispr_oauth);
		response.setHeader('Set-Cookie', cookie('wispr_oauth', '', 0));
		const params = new URL(request.url, origin).searchParams;
		if (!configured || !attempt || attempt.expires <= Date.now() || params.get('state') !== attempt.state || !params.get('code') || params.has('error')) { redirect(response, '/?auth=failed'); return true; }
		try {
			const token = await fetchJson('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: params.get('code'), client_id: clientId, client_secret: clientSecret, redirect_uri: `${origin}/auth/google/callback`, grant_type: 'authorization_code', code_verifier: attempt.verifier }) });
			const user = await verifyIdToken(token.id_token, attempt.nonce);
			if (sessions.size >= 10000) { throw new Error('Session capacity reached'); }
			sessions.delete(jar.wispr_session);
			const id = random(); sessions.set(id, { user, expires: Date.now() + 28800000 });
			response.setHeader('Set-Cookie', [cookie('wispr_oauth', '', 0), cookie('wispr_session', id, 28800)]);
			redirect(response, '/?auth=success');
		} catch { redirect(response, '/?auth=failed'); }
		return true;
	}
	json(response, 404, { error: 'Not found' }); return true;
}
module.exports = { handleAuth };
