/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { official, findDesktop, launchDesktop } = require('../official-flow.cjs');

test('uses the endpoint published in the official Wispr plugin', () => {
	assert.equal(official.mcp, 'https://api.wisprflow.ai/connect/mcp');
	assert.equal(official.download, 'https://wisprflow.ai/downloads');
});
test('finds the installed Windows launcher without inspecting account files', async () => {
	const expected = path.join('C:/Local', 'WisprFlow', 'Wispr Flow.exe');
	const visited = [];
	const found = await findDesktop({ platform: 'win32', env: { LOCALAPPDATA: 'C:/Local' }, io: { stat: async file => { visited.push(file); return { isFile: () => file === expected }; } } });
	assert.equal(found, expected);
	assert.deepEqual(visited, [expected]);
});
test('uses the newest valid versioned installation if the launcher is missing', async () => {
	const expected = path.join('C:/Local', 'WisprFlow', 'app-1.10.0', 'Wispr Flow.exe');
	const found = await findDesktop({ platform: 'win32', env: { LOCALAPPDATA: 'C:/Local' }, io: { readdir: async () => ['app-1.9.0', '../evil', 'app-1.10.0'], stat: async file => ({ isFile: () => file === expected }) } });
	assert.equal(found, expected);
});
test('launches a verified application as an executable, never shell text', async () => {
	let invocation;
	const child = new EventEmitter(); child.unref = () => {};
	const result = await launchDesktop({ platform: 'win32', env: { LOCALAPPDATA: 'C:/Local' }, io: { stat: async () => ({ isFile: () => true }) }, spawn: (...args) => { invocation = args; process.nextTick(() => child.emit('spawn')); return child; } });
	assert.equal(result, true);
	assert.equal(invocation[2].shell, false);
	assert.equal(invocation[2].windowsHide, true);
	assert.deepEqual(invocation[1], []);
});
test('unsupported platforms fall back to the official website without spawning', async () => {
	assert.equal(await launchDesktop({ platform: 'linux', spawn: () => { throw new Error('Must not spawn'); } }), false);
});
