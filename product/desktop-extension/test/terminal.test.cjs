/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AgentTerminal } = require('../terminal.cjs');

function harness() {
	const prompts = [], writes = [];
	let interrupts = 0;
	const terminal = new AgentTerminal({ write: text => writes.push(text), send: async text => { prompts.push(text); return prompts.length > 1 ? 'steered' : 'started'; }, interrupt: async () => { interrupts++; }, login: async () => {}, reset: async () => {} });
	terminal.open();
	return { terminal, prompts, writes, get interrupts() { return interrupts; } };
}
test('a verified Flow transcript is sent automatically exactly once', async () => {
	const app = harness();
	try {
		app.terminal.arm(1);
		await app.terminal.transcript(1, 'Write a function');
		await app.terminal.handleInput('\x1b[200~Write a function\x1b[201~');
		await app.terminal.transcript(1, 'Write a function');
		assert.deepEqual(app.prompts, ['Write a function']);
	} finally { app.terminal.dispose(); }
});
test('Flow paste arriving before clipboard provenance is not sent twice', async () => {
	const app = harness();
	try {
		app.terminal.arm(2);
		await app.terminal.handleInput('Fix the failing test');
		assert.equal(app.prompts.length, 0);
		await app.terminal.transcript(2, 'Fix the failing test');
		assert.deepEqual(app.prompts, ['Fix the failing test']);
	} finally { app.terminal.dispose(); }
});
test('ordinary clipboard paste is a manual draft until Enter', async () => {
	const app = harness();
	try {
		await app.terminal.handleInput('a multiline\nprompt');
		assert.equal(app.prompts.length, 0);
		await app.terminal.handleInput('\r');
		assert.deepEqual(app.prompts, ['a multiline\nprompt']);
	} finally { app.terminal.dispose(); }
});
test('unarmed or cancelled transcripts never invoke an agent', async () => {
	const app = harness();
	try {
		await app.terminal.transcript(99, 'Not from an armed capture');
		app.terminal.arm(3); app.terminal.cancel(); await app.terminal.transcript(3, 'Cancelled');
		assert.equal(app.prompts.length, 0);
	} finally { app.terminal.dispose(); }
});
test('Ctrl+C and explicit stop interrupt rather than create another request', async () => {
	const app = harness();
	try {
		await app.terminal.handleInput('\x03'); await app.terminal.submit('stop');
		assert.equal(app.interrupts, 2);
		assert.equal(app.prompts.length, 0);
	} finally { app.terminal.dispose(); }
});
