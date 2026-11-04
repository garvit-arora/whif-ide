/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PromptView, recovery, renderPrompt } = require('../prompt.cjs');
const { AgentTerminal } = require('../terminal.cjs');

function harness() {
	const calls = [];
	const api = { l10n: { t: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, index) => args[index]) } };
	const prompt = new PromptView(api, { hotkey: () => 'Copilot', autoSend: () => true, submit: async text => { calls.push(text); }, stop: async () => calls.push('stop') });
	return { prompt, calls };
}
test('prompt bridge rejects malformed messages and unknown actions', async () => {
	const app = harness();
	try { await app.prompt.receive(null); await app.prompt.receive({ type: 'submit', text: {} }); await app.prompt.receive({ type: 'submit', text: 'a'.repeat(100001) }); await app.prompt.receive({ type: 'runShell', text: 'bad' }); assert.deepEqual(app.calls, []); }
	finally { app.prompt.dispose(); }
});
test('manual submission and stop use explicit actions', async () => {
	const app = harness();
	try { await app.prompt.receive({ type: 'submit', text: 'Make a function' }); await app.prompt.receive({ type: 'stop' }); assert.deepEqual(app.calls, ['Make a function', 'stop']); }
	finally { app.prompt.dispose(); }
});

test('focus requested before webview readiness is delivered again after ready', async () => {
	const app = harness();
	const messages = [];
	try {
		app.prompt.focus();
		app.prompt.view = { webview: { postMessage: message => messages.push(message) } };
		await app.prompt.receive({ type: 'ready' });
		assert.deepEqual(messages.map(message => message.type), ['state', 'focus']);
	} finally { app.prompt.dispose(); }
});
test('verified Flow transcript routes automatically without a second UI submission', async () => {
	const app = harness();
	const input = new AgentTerminal({ write: () => {}, send: async text => { app.calls.push(text); return 'started'; }, onEvent: event => app.prompt.event(event) });
	input.open();
	try { input.arm(1); await input.transcript(1, 'Build this'); await input.transcript(1, 'Build this'); assert.deepEqual({ calls: app.calls, stage: app.prompt.state.stage, messages: app.prompt.state.messages }, { calls: ['Build this'], stage: 'working', messages: [{ role: 'user', text: 'Build this' }] }); }
	finally { input.dispose(); app.prompt.dispose(); }
});
test('errors preserve the submitted instruction and offer sign-in recovery', async () => {
	const app = harness();
	const input = new AgentTerminal({ write: () => {}, send: async () => { throw new Error('Codex CLI is not signed in.'); }, onEvent: event => app.prompt.event(event) });
	try { await input.submit('Keep my prompt'); assert.equal(app.prompt.state.error.action, 'login'); assert.equal(input.failedPrompt, 'Keep my prompt'); assert.equal(app.prompt.state.messages[0].text, 'Keep my prompt'); }
	finally { input.dispose(); app.prompt.dispose(); }
});
test('recovery distinguishes workspace access and account limits', () => {
	assert.deepEqual([recovery('Open a local workspace folder').action, recovery('429 quota exceeded').action], ['folder', 'retry']);
});
test('cancelling dictation preserves the running task and its stop control', () => {
	const app = harness();
	try { app.prompt.status('codex', 'working'); app.prompt.event({ type: 'listening' }); app.prompt.event({ type: 'cancelled' }); assert.deepEqual({ stage: app.prompt.state.stage, active: app.prompt.state.active }, { stage: 'working', active: true }); }
	finally { app.prompt.dispose(); }
});
test('agent output is bounded and view HTML denies network/script injection', () => {
	const app = harness();
	try {
		app.prompt.append('x'.repeat(200000)); assert.ok(app.prompt.state.messages[0].text.length <= 100000);
		const uri = { joinPath: (...parts) => parts.join('/') };
		const html = renderPrompt({ cspSource: 'local-source', asWebviewUri: value => value }, uri, 'media');
		assert.match(html, /default-src 'none'/); assert.match(html, /script-src 'nonce-/); assert.doesNotMatch(html, /unsafe-inline|https:|onclick=/);
	} finally { app.prompt.dispose(); }
});
