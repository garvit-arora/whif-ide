/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

function watchFlow(options) {
	const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
	const child = (options.spawn ?? spawn)(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(options.extensionPath, 'native', 'watch-flow.ps1'), '-IdeExe', process.execPath, '-FlowRoot', options.flowRoot, '-Hotkey', options.hotkey, '-ParentPid', String(process.pid)], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
	let disposed = false;
	const lines = readline.createInterface({ input: child.stdout });
	lines.on('line', line => {
		if (line.length > 700000) { return; }
		try { options.onEvent(JSON.parse(line)); } catch { }
	});
	child.stderr.on('data', () => {});
	child.on('error', error => options.onError(error));
	child.on('exit', code => { if (!disposed && code !== 0) { options.onError(new Error('Flow hotkey watcher stopped. Check the configured hotkey or use the terminal manually.')); } });
	return { dispose: () => { disposed = true; lines.close(); child.kill(); } };
}
module.exports = { watchFlow };
