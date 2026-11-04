/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { CodexSession } = require('../agents/codex.cjs');

function harness(options = {}) {
	const requests = [], replies = [];
	const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
	let sequence = 0;
	const notify = (method, params) => child.stdout.write(JSON.stringify({ method, params }) + '\n');
	child.stdin = new Writable({ write(chunk, _encoding, done) {
		const message = JSON.parse(chunk.toString());
		if (!message.method) { replies.push(message); done(); return; }
		requests.push(message);
		if (message.id === undefined) { done(); return; }
		let result;
		if (message.method === 'initialize') { result = {}; }
		if (message.method === 'account/read') { result = options.signedOut ? { account: null, requiresOpenaiAuth: true } : { account: { type: 'chatgpt', planType: 'test' }, requiresOpenaiAuth: true }; }
		if (message.method === 'thread/start') { result = { thread: { id: 'thread-owned' } }; }
		if (message.method === 'model/list') { result = { data: options.models ?? [{ model: 'account-available', isDefault: true, hidden: false }] }; }
		if (message.method === 'turn/start') { result = { turn: { id: 'turn-' + (++sequence) } }; }
		if (message.method === 'turn/steer') { result = { turnId: message.params.expectedTurnId }; }
		if (message.method === 'turn/interrupt') { result = {}; }
		setTimeout(() => {
			child.stdout.write(JSON.stringify({ id: message.id, result }) + '\n');
			if (message.method === 'turn/interrupt') { notify('turn/completed', { turn: { id: message.params.turnId, status: 'interrupted' } }); }
		}, message.method === 'turn/start' ? (options.startDelay ?? 0) : 0);
		done();
	} });
	const session = new CodexSession({ executable: 'codex.exe', cwd: 'workspace', spawn: () => child, approve: async () => false, questions: async () => ({}), onOutput: () => {}, model: options.model, reasoningEffort: options.reasoningEffort, ideTools: options.ideTools });
	return { session, requests, replies, notify };
}

test('an active Codex turn is steered, not queued as a second turn', async () => {
	const app = harness();
	try {
		assert.equal(await app.session.send('Build the function'), 'started');
		assert.equal(await app.session.send('Use TypeScript and add tests'), 'steered');
		assert.deepEqual(app.requests.filter(item => item.method.startsWith('turn/')).map(item => item.method), ['turn/start', 'turn/steer']);
		assert.equal(app.requests.at(-1).params.expectedTurnId, 'turn-1');
	} finally { app.session.dispose(); }
});
test('a follow-up received during turn startup steers the same turn', async () => {
	const app = harness({ startDelay: 30 });
	try {
		await Promise.all([app.session.send('First instruction'), app.session.send('Correction')]);
		assert.equal(app.requests.filter(item => item.method === 'turn/start').length, 1);
		assert.equal(app.requests.filter(item => item.method === 'turn/steer').length, 1);
	} finally { app.session.dispose(); }
});
test('interrupt targets only the owned thread and active turn', async () => {
	const app = harness();
	try {
		await app.session.send('Work'); await app.session.interrupt();
		assert.deepEqual(app.requests.find(item => item.method === 'turn/interrupt').params, { threadId: 'thread-owned', turnId: 'turn-1' });
	} finally { app.session.dispose(); }
});
test('a missing CLI login stops before sending any code prompt', async () => {
	const app = harness({ signedOut: true });
	try {
		await assert.rejects(app.session.send('Do work'), /not signed in/);
		assert.equal(app.requests.some(item => item.method === 'turn/start'), false);
	} finally { app.session.dispose(); }
});
test('denied tool approval is forwarded as a denial', async () => {
	const app = harness();
	try {
		await app.session.connect();
		app.notify('unused', {});
		await app.session.receive({ id: 900, method: 'item/commandExecution/requestApproval', params: { command: 'deploy' } });
		assert.deepEqual(app.replies.at(-1), { id: 900, result: { decision: 'decline' } });
	} finally { app.session.dispose(); }
});

test('requested Sol model and low effort override an obsolete catalog default', async () => {
	const app = harness({ model: 'gpt-6.1-sol', reasoningEffort: 'low', models: [{ model: 'gpt-5.5', isDefault: true }, { model: 'gpt-6.1-sol', supportedReasoningEfforts: [{ reasoningEffort: 'low' }] }] });
	try {
		await app.session.send('Build it');
		assert.deepEqual({ threadModel: app.requests.find(item => item.method === 'thread/start').params.model, turnModel: app.requests.find(item => item.method === 'turn/start').params.model, effort: app.requests.find(item => item.method === 'turn/start').params.effort }, { threadModel: 'gpt-6.1-sol', turnModel: 'gpt-6.1-sol', effort: 'low' });
	} finally { app.session.dispose(); }
});

test('unavailable requested models fail before inference instead of silently substituting', async () => {
	const app = harness({ model: 'gpt-6.1-sol' });
	try { await assert.rejects(app.session.send('Build it'), /No other model was substituted/); assert.equal(app.requests.some(item => item.method === 'turn/start'), false); }
	finally { app.session.dispose(); }
});

test('unsupported reasoning effort is rejected before inference', async () => {
	const app = harness({ model: 'account-available', reasoningEffort: 'light' });
	try { await assert.rejects(app.session.send('Build it'), /does not advertise light/); assert.equal(app.requests.some(item => item.method === 'turn/start'), false); }
	finally { app.session.dispose(); }
});

test('IDE dynamic tools register and return structured tool results', async () => {
	const app = harness({ ideTools: { definitions: [{ type: 'function', name: 'wispr_ide_context', description: 'Read context', inputSchema: { type: 'object', properties: {} } }], call: async () => ({ workspace: 'Demo' }) } });
	try {
		await app.session.connect();
		assert.equal(app.requests.find(item => item.method === 'initialize').params.capabilities.experimentalApi, true);
		assert.equal(app.requests.find(item => item.method === 'thread/start').params.dynamicTools[0].name, 'wispr_ide_context');
		await app.session.receive({ id: 901, method: 'item/tool/call', params: { tool: 'wispr_ide_context', arguments: {} } });
		assert.deepEqual(app.replies.at(-1).result, { success: true, contentItems: [{ type: 'inputText', text: '{"workspace":"Demo"}' }] });
	} finally { app.session.dispose(); }
});
