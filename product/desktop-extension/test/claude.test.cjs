/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ClaudeSession } = require('../agents/claude.cjs');

function harness() {
	const prompts = [], events = [], pending = [];
	let waiter, stopped = false, interrupts = 0;
	const emit = item => { pending.push(item); waiter?.(); waiter = undefined; };
	const query = {
		initializationResult: async () => ({}),
		interrupt: async () => { interrupts++; events.push('interrupt'); setTimeout(() => emit({ type: 'result', subtype: 'interrupted' }), 5); },
		close: () => { stopped = true; waiter?.(); },
		async *[Symbol.asyncIterator]() { while (!stopped) { if (!pending.length) { await new Promise(resolve => { waiter = resolve; }); } while (pending.length) { yield pending.shift(); } } }
	};
	const session = new ClaudeSession({ cwd: 'test', executable: 'claude.exe', approve: async () => false, loadSdk: async () => ({ query({ prompt }) {
		void (async () => { for await (const message of prompt) { prompts.push(message.message.content); events.push(message.message.content); } })();
		return query;
	} }) });
	return { session, prompts, events, get interrupts() { return interrupts; } };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
test('Claude follow-ups interrupt before delivering the next instruction', async () => {
	const app = harness();
	try {
		assert.equal(await app.session.send('Build'), 'started'); await tick();
		assert.equal(await app.session.send('Correction'), 'interrupted-and-steered'); await tick();
		assert.deepEqual(app.events, ['Build', 'interrupt', 'Correction']);
	} finally { app.session.dispose(); }
});
test('simultaneous Claude corrections each interrupt their predecessor', async () => {
	const app = harness();
	try {
		await app.session.send('First');
		await Promise.all([app.session.send('Second'), app.session.send('Third')]); await tick();
		assert.deepEqual(app.events, ['First', 'interrupt', 'Second', 'interrupt', 'Third']);
		assert.equal(app.interrupts, 2);
	} finally { app.session.dispose(); }
});
test('closed Claude sessions reject further prompts', async () => {
	const app = harness();
	await app.session.connect(); app.session.dispose();
	await assert.rejects(app.session.send('Never sent'), /disconnected/);
	assert.equal(app.prompts.length, 0);
});
