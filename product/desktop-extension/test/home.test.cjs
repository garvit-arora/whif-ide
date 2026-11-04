/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HomeView, describeWorkspace, renderHome } = require('../home.cjs');

function harness(folders = [], trusted = true) {
	const calls = [];
	const api = { l10n: { t: value => value }, workspace: { workspaceFolders: folders, isTrusted: trusted, getConfiguration: () => ({ get: (key, fallback) => key === 'hotkey' ? 'Copilot' : fallback }) }, commands: { executeCommand: async id => calls.push(id) } };
	return { api, calls, home: new HomeView(api, 'extension') };
}
test('empty windows direct Build and login to folder selection', async () => {
	const app = harness();
	await app.home.receive({ action: 'build' }); await app.home.receive({ action: 'login' });
	assert.deepEqual(app.calls, ['workbench.action.files.openFolder', 'workbench.action.files.openFolder']);
});
test('trusted projects connect real build, hotkey configuration and stop commands', async () => {
	const app = harness([{ name: 'Demo', uri: { scheme: 'file' } }]);
	for (const action of ['build', 'configure', 'stop']) { await app.home.receive({ action }); }
	assert.deepEqual(app.calls, ['wispr.open', 'wispr.configureHotkey', 'wispr.stopAgent']);
});
test('untrusted projects offer workspace trust instead of agent execution', async () => {
	const app = harness([{ name: 'Demo', uri: { scheme: 'file' } }], false);
	await app.home.receive({ action: 'build' });
	assert.deepEqual(app.calls, ['workbench.trust.manage']);
});
test('home bridge rejects arbitrary commands and malformed messages', async () => {
	const app = harness();
	for (const message of [null, {}, { action: 'workbench.action.terminal.sendSequence' }, { action: '__proto__' }, { action: 1 }]) { await app.home.receive(message); }
	assert.deepEqual(app.calls, []);
});
test('home shows configured shortcut and escapes workspace names', () => {
	const app = harness([{ name: '<script>alert(1)</script>', uri: { scheme: 'file' } }]);
	const html = renderHome({ cspSource: 'local-source', asWebviewUri: value => value }, { joinPath: (...parts) => parts.join('/') }, 'media', describeWorkspace(app.api));
	assert.match(html, /<kbd>Copilot<\/kbd>/);
	assert.match(html, /&lt;script&gt;/);
	assert.match(html, /default-src 'none'/);
	assert.doesNotMatch(html, /<script>alert|onclick=|unsafe-inline/);
});
