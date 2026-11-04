/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');

function run(executable, args, timeout = 12000) {
	return new Promise(resolve => execFile(executable, args, { windowsHide: true, timeout, maxBuffer: 256000, shell: false }, (error, stdout, stderr) => resolve({ ok: !error, stdout, stderr })));
}

/** Discover actual CLI executables, not arbitrary shell aliases, and ask the CLI about its own login. */
async function discover(options = {}) {
	const env = options.env ?? process.env;
	const platform = options.platform ?? process.platform;
	const home = options.home ?? os.homedir();
	const io = options.io ?? fs;
	const probe = options.run ?? run;
	const suffix = platform === 'win32' ? '.exe' : '';
	const candidates = { codex: [], claude: [] };
	if (options.codexPath) { candidates.codex.push(options.codexPath); }
	if (options.bundledCodexPath) { candidates.codex.push(options.bundledCodexPath); }
	if (options.claudePath) { candidates.claude.push(options.claudePath); }
	for (const folder of (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)) {
		for (const kind of ['codex', 'claude']) { candidates[kind].push(path.join(folder, kind + suffix)); }
	}
	for (const kind of ['codex', 'claude']) { candidates[kind].push(path.join(home, '.local', 'bin', kind + suffix)); }
	if (platform === 'win32' && env.LOCALAPPDATA) { candidates.codex.push(path.join(env.LOCALAPPDATA, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')); }
	const result = [];
	for (const kind of ['codex', 'claude']) {
		let first;
		for (const executable of [...new Set(candidates[kind])]) {
			try { if (!(await io.stat(executable)).isFile()) { continue; } } catch { continue; }
			const status = await probe(executable, kind === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json']);
			let authenticated = false;
			let authMethod;
			if (kind === 'codex') { authenticated = status.ok && /logged in/i.test(status.stdout + status.stderr) && !/not logged in/i.test(status.stdout + status.stderr); }
			else { try { const info = JSON.parse(status.stdout); authenticated = info.loggedIn === true; authMethod = info.authMethod; } catch { } }
			const candidate = { kind, executable, authenticated, authMethod };
			first ??= candidate;
			if (authenticated) { first = candidate; break; }
		}
		if (first) { result.push(first); }
	}
	return result;
}

function choose(agents, preference = 'codex') {
	return agents.find(agent => agent.kind === preference && agent.authenticated)
		?? agents.find(agent => agent.authenticated)
		?? agents.find(agent => agent.kind === preference)
		?? agents[0];
}
module.exports = { discover, choose, run };
