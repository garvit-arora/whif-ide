/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createIdeTools } = require('../ide-tools.cjs');
function harness(allow = true, trusted = true) {
	const commands = [], approvals = [];
	const extension = { id: 'demo.tools', isActive: false, packageJSON: { contributes: { commands: [{ command: 'demo.hello', title: 'Hello' }] } }, activate: async () => { commands.push('activate'); } };
	const api = { workspace: { isTrusted: trusted, workspaceFolders: [{ name: 'Demo', uri: { scheme: 'file', fsPath: 'workspace' } }] }, window: { visibleTextEditors: [], activeTextEditor: null }, extensions: { all: [extension], getExtension: id => id === extension.id ? extension : null }, commands: { executeCommand: async (...args) => { commands.push(args); } } };
	return { commands, approvals, tools: createIdeTools(api, async (...args) => { approvals.push(args); return allow; }) };
}
test('voice agent installs an extension only after approval', async () => {
	const app = harness(); await app.tools.call('wispr_ide_action', { action: 'installExtension', extensionId: 'demo.tools' });
	assert.deepEqual(app.commands, [['workbench.extensions.installExtension', 'demo.tools', { enable: true }]]); assert.equal(app.approvals.length, 1);
});
test('declined installation cannot execute the install command', async () => {
	const app = harness(false); await assert.rejects(app.tools.call('wispr_ide_action', { action: 'installExtension', extensionId: 'demo.tools' }), /declined/); assert.deepEqual(app.commands, []);
});
test('using an installed extension activates it and runs only declared commands', async () => {
	const app = harness(); await app.tools.call('wispr_ide_action', { action: 'extensionCommand', extensionId: 'demo.tools', commandId: 'demo.hello' }); assert.deepEqual(app.commands, ['activate', ['demo.hello']]);
	await assert.rejects(app.tools.call('wispr_ide_action', { action: 'extensionCommand', extensionId: 'demo.tools', commandId: 'terminal.sendSequence' }), /not declared/);
});
test('context describes installed extension commands without arbitrary screen capture', async () => {
	const app = harness(); const context = await app.tools.call('wispr_ide_context', {}); assert.equal(context.extensions[0].commands[0].id, 'demo.hello');
});
test('untrusted workspaces, arbitrary commands and remote VSIX paths are rejected', async () => {
	await assert.rejects(harness(true, false).tools.call('wispr_ide_context', {}), /trust/);
	await assert.rejects(harness().tools.call('wispr_ide_action', { action: 'installExtension', extensionId: 'https://evil.example/x.vsix' }), /publisher/);
	await assert.rejects(harness().tools.call('exec', {}), /Unknown/);
});
