/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { discover, choose } = require('../agents/discovery.cjs');
const { loadSkills, catalog } = require('../skills.cjs');
const path = require('node:path');

test('Codex is preferred when both existing CLI logins are available', () => {
	assert.equal(choose([{ kind: 'claude', authenticated: true }, { kind: 'codex', authenticated: true }]).kind, 'codex');
});
test('sign-in is checked through CLI commands without reading credential files', async () => {
	const calls = [];
	const agents = await discover({ platform: 'win32', home: 'C:/Home', env: { LOCALAPPDATA: 'C:/Local' }, io: { stat: async file => ({ isFile: () => file.endsWith('codex.exe') || file.endsWith('claude.exe') }) }, run: async (executable, args) => { calls.push(args); return executable.endsWith('codex.exe') ? { ok: true, stdout: 'Logged in using ChatGPT', stderr: '' } : { ok: true, stdout: '{"loggedIn":true,"authMethod":"third_party","email":"not-returned"}', stderr: '' }; } });
	assert.deepEqual(calls, [['login', 'status'], ['auth', 'status', '--json']]);
	assert.equal(agents.every(agent => agent.authenticated), true);
	assert.equal(JSON.stringify(agents).includes('not-returned'), false);
});
test('skill resources remain available from the command palette integration', async () => {
	assert.equal((await loadSkills(path.resolve(__dirname, '..'), catalog.map(skill => skill.id))).length, 4);
});
