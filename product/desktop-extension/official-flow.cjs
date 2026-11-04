/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const official = Object.freeze({
	website: 'https://wisprflow.ai/',
	developers: 'https://wisprflow.ai/developers',
	download: 'https://wisprflow.ai/downloads',
	help: 'https://docs.wisprflow.ai/articles/6409258247-flow-bubble-requirements',
	mcp: 'https://api.wisprflow.ai/connect/mcp',
	connector: 'https://github.com/Wispr-AI/wispr-flow-plugin'
});

/** Locate an existing install without reading account data, tokens, or Flow's internal APIs. */
async function findDesktop(options = {}) {
	const platform = options.platform ?? process.platform;
	const io = options.io ?? fs;
	const env = options.env ?? process.env;
	const home = options.home ?? os.homedir();
	async function exists(file) {
		try { return (await io.stat(file)).isFile(); } catch { return false; }
	}
	if (platform === 'win32' && env.LOCALAPPDATA) {
		const folder = path.join(env.LOCALAPPDATA, 'WisprFlow');
		const launcher = path.join(folder, 'Wispr Flow.exe');
		if (await exists(launcher)) { return launcher; }
		let versions = [];
		try { versions = (await io.readdir(folder)).filter(name => /^app-\d+(?:\.\d+)+(?:-[\w.-]+)?$/.test(name)); } catch { return undefined; }
		versions.sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
		for (const version of versions) {
			const executable = path.join(folder, version, 'Wispr Flow.exe');
			if (await exists(executable)) { return executable; }
		}
	}
	if (platform === 'darwin') {
		for (const app of ['/Applications/Wispr Flow.app', path.join(home, 'Applications', 'Wispr Flow.app')]) {
			try { if ((await io.stat(app)).isDirectory()) { return app; } } catch { /* Try the next documented Applications location. */ }
		}
	}
	return undefined;
}

/** Launch only a detected desktop installation; never synthesize keyboard shortcuts or record audio. */
async function launchDesktop(options = {}) {
	const executable = await findDesktop(options);
	if (!executable) { return false; }
	const platform = options.platform ?? process.platform;
	const launch = options.spawn ?? spawn;
	await new Promise((resolve, reject) => {
		const child = launch(platform === 'darwin' ? '/usr/bin/open' : executable, platform === 'darwin' ? ['-a', executable] : [], { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
		child.once('error', reject);
		child.once('spawn', () => { child.unref(); resolve(); });
	});
	return true;
}
module.exports = { official, findDesktop, launchDesktop };
