/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs/promises');
const { discover, choose } = require('./agents/discovery.cjs');
const { CodexSession } = require('./agents/codex.cjs');
const { ClaudeSession } = require('./agents/claude.cjs');
const { AgentTerminal } = require('./terminal.cjs');
const { watchFlow } = require('./watcher.cjs');
const { official, findDesktop, launchDesktop } = require('./official-flow.cjs');
const { catalog } = require('./skills.cjs');
const { PromptView } = require('./prompt.cjs');
const { HomeView } = require('./home.cjs');
const { createIdeTools } = require('./ide-tools.cjs');

function activate(context) {
	const t = vscode.l10n.t;
	let terminal, input, engine, watcher, agents, initialization, provider, prompt;
	const writes = new vscode.EventEmitter();
	context.subscriptions.push(writes);
	let watcherGeneration = 0;
	let sessionGeneration = 0, connectingEngine;
	let enabled = context.globalState.get('wispr.voice.enabled') !== false;
	const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(status);
	status.command = 'wispr.open';
	status.tooltip = t('Open the voice and text prompt. Official Flow handles dictation.');
	status.show();
	const config = () => vscode.workspace.getConfiguration('wispr.voice');
	const home = new HomeView(vscode, context.extensionUri, () => enabled && config().get('autoSend', true));
	context.subscriptions.push(home);
	const folder = () => vscode.workspace.workspaceFolders?.[0]?.uri;
	const output = text => { input?.output(text); prompt?.append(text); };
	const updateStatus = text => { status.text = `$(mic) Flow → ${text ?? (enabled ? 'Agent' : t('Off'))}`; };
	const requireWorkspace = () => {
		if (!vscode.workspace.isTrusted) { throw new Error(t('Trust this workspace before sending code instructions to an agent.')); }
		if (folder()?.scheme !== 'file') { throw new Error(t('Open a local workspace folder first.')); }
		return folder().fsPath;
	};
	const listAgents = async () => agents ??= await discover({ codexPath: config().get('codexPath') || undefined, bundledCodexPath: path.join(context.extensionPath, 'runtime', 'bin', 'codex.exe'), claudePath: config().get('claudePath') || undefined });
	async function approve(kind, details) {
		const choice = await vscode.window.showWarningMessage(t('Allow the coding agent to perform this action?'), { modal: true, detail: `${kind}\n${JSON.stringify(details, null, 2).slice(0, 8000)}` }, t('Allow Once'), t('Deny'));
		return choice === t('Allow Once');
	}
	async function questions(items) {
		const answers = {};
		for (const question of items) {
			const response = question.options?.length ? await vscode.window.showQuickPick(question.options.map(option => ({ label: option.label, description: option.description })), { placeHolder: question.question }) : await vscode.window.showInputBox({ prompt: question.question });
			answers[question.id] = { answers: response === undefined ? [] : [typeof response === 'string' ? response : response.label] };
		}
		return answers;
	}
	async function session() {
		if (!await findDesktop()) {
			const action = await vscode.window.showWarningMessage(t('Wispr Flow is required. Install the official desktop app before starting the agent.'), t('Download Wispr Flow'));
			if (action) { await vscode.env.openExternal(vscode.Uri.parse(official.download)); }
			throw new Error(t('Install official Wispr Flow, then retry. Your instruction has been kept.'));
		}
		if (engine) { return engine; }
		if (initialization) { return initialization; }
		const generation = sessionGeneration;
		const task = initialization = (async () => {
			const cwd = requireWorkspace();
			const available = await listAgents();
			const preference = config().get('preferredAgent', 'codex');
			const preferred = available.find(agent => agent.kind === preference);
			const selected = choose(available, preference);
			const candidates = [...new Set([preferred, selected, ...available.filter(agent => agent.authenticated)].filter(Boolean))];
			if (!candidates.length) { throw new Error(t('No Codex or Claude Code CLI was found. Install and sign in to one, then use /new.')); }
			let failure;
			for (const agent of candidates) {
				if (generation !== sessionGeneration) { throw new Error(t('Session changed. Resend the instruction in the current workspace.')); }
				const options = { executable: agent.executable, cwd, approve, questions, onOutput: output, onError: message => { if (input?.lastPrompt) { input.failedPrompt = input.lastPrompt; } prompt?.error(message); }, onStatus: state => { updateStatus(`${agent.kind} · ${state}`); prompt?.status(agent.kind, state); } };
				const candidate = agent.kind === 'codex' ? new CodexSession(options) : new ClaudeSession(options);
				if (agent.kind === 'codex') { options.model = config().get('model', 'gpt-6.1-sol'); options.reasoningEffort = config().get('reasoningEffort', 'low'); options.ideTools = createIdeTools(vscode, approve); }
				connectingEngine = candidate;
				try {
					await candidate.connect();
					if (generation !== sessionGeneration) { candidate.dispose(); throw new Error(t('Session changed. Resend the instruction in the current workspace.')); }
					engine = candidate;
					prompt?.connected(agent.kind);
					output(`\n[Using installed ${agent.kind}; existing CLI account and provider settings]\n`);
					if (agent.kind !== preference) { output(`[${preference} was unavailable or needed sign-in; using ${agent.kind}. Subscription and quota are checked by that CLI's provider.]\n`); }
					return engine;
				} catch (error) { failure = error; candidate.dispose(); if (error.code === 'WISPR_MODEL_UNAVAILABLE') { throw error; } output(`[${agent.kind}] ${error.message}\n`); }
				finally { if (connectingEngine === candidate) { connectingEngine = undefined; } }
			}
			throw failure;
		})();
		try { return await task; } finally { if (initialization === task) { initialization = undefined; } }
	}
	async function reset() { sessionGeneration++; connectingEngine?.dispose(); connectingEngine = undefined; initialization = undefined; engine?.dispose(); engine = undefined; agents = undefined; updateStatus(); }
	async function interrupt() { if (engine) { await engine.interrupt(); } else if (initialization) { await reset(); } }
	async function login() {
		const available = await listAgents();
		const agent = available.find(item => item.kind === config().get('preferredAgent', 'codex')) ?? available[0];
		if (!agent) { throw new Error(t('Install Codex or Claude Code first.')); }
		const loginTerminal = vscode.window.createTerminal({ name: `${agent.kind} sign-in`, shellPath: agent.executable, shellArgs: agent.kind === 'codex' ? ['login'] : ['auth', 'login'], cwd: requireWorkspace() });
		context.subscriptions.push(loginTerminal);
		loginTerminal.show();
		agents = undefined;
		output('Complete sign-in in the CLI terminal, then use /new and retry your prompt.\n');
	}
	function ensureInput() {
		if (!input) {
			input = new AgentTerminal({ write: value => writes.fire(value), send: async text => { requireWorkspace(); return (await session()).send(text); }, interrupt, login, reset, onEvent: event => prompt?.event(event) });
			input.open();
		}
		return input;
	}
	async function openPrompt() {
		ensureInput();
		await vscode.commands.executeCommand('wispr.prompt.focus');
		prompt.focus();
	}
	function openTerminal() {
		requireWorkspace();
		if (!terminal) {
			const ownedInput = ensureInput();
			terminal = vscode.window.createTerminal({ name: 'Flow → Coding Agent', pty: {
				onDidWrite: writes.event,
				open: () => ownedInput.open(),
				close: () => { terminal = undefined; },
				handleInput: data => { void ownedInput.handleInput(data).catch(error => output(`[Error] ${error.message}\n`)); }
			} });
		}
		terminal.show(false);
		return input;
	}
	async function startWatcher() {
		const generation = ++watcherGeneration;
		watcher?.dispose(); watcher = undefined;
		updateStatus();
		prompt?.configure();
		if (!enabled || config().get('autoSend', true) === false || !vscode.workspace.isTrusted || folder()?.scheme !== 'file') { return; }
		if (process.platform !== 'win32') { status.tooltip = t('Automatic hotkey routing currently supports Windows. You can still dictate into the agent terminal and press Enter.'); return; }
		const executable = await findDesktop();
		if (generation !== watcherGeneration) { return; }
		if (!executable) { status.tooltip = t('Install the official Wispr Flow desktop app to enable automatic dictation routing.'); return; }
		const appDirectory = path.dirname(executable);
		const flowRoot = /^app-/.test(path.basename(appDirectory)) ? path.dirname(appDirectory) : appDirectory;
		watcher = watchFlow({ extensionPath: context.extensionPath, flowRoot, hotkey: config().get('hotkey', 'Ctrl+Win'),
			onEvent: event => {
				if (generation !== watcherGeneration || !enabled || !vscode.workspace.isTrusted) { return; }
				try {
					if (event.type === 'hotkey') { ensureInput().arm(event.sequence); void openPrompt().catch(error => prompt.error(error.message)); }
					if (event.type === 'transcript') { void ensureInput().transcript(event.sequence, event.text).catch(error => prompt.error(error.message)); }
					if (event.type === 'cancelled' || event.type === 'expired') { input?.cancel(); }
					if (event.type === 'error') { prompt.error(event.message); }
				} catch (error) { void vscode.window.showErrorMessage(error.message); }
			},
			onError: error => { updateStatus(t('Manual')); status.tooltip = error.message; prompt.error(error.message); }
		});
	}
	function registerContext() {
		if (!provider) { provider = vscode.lm.registerMcpServerDefinitionProvider('wispr-flow.official', { provideMcpServerDefinitions: () => [new vscode.McpHttpServerDefinition('Wispr Flow', vscode.Uri.parse(official.mcp), {}, '1')] }); context.subscriptions.push(provider); }
	}
	const command = (id, callback) => context.subscriptions.push(vscode.commands.registerCommand(id, async (...args) => { try { return await callback(...args); } catch (error) { await vscode.window.showErrorMessage(error.message); } }));
	const refreshAccount = async () => { agents = undefined; prompt.account(await listAgents()); };
	prompt = new PromptView(vscode, { extensionUri: context.extensionUri, hotkey: () => config().get('hotkey', 'Ctrl+Win'), autoSend: () => enabled && config().get('autoSend', true),
		submit: text => ensureInput().submit(text), stop: interrupt, login,
		retry: async () => { const text = ensureInput().failedPrompt; await reset(); if (text) { await ensureInput().submit(text); } else { await refreshAccount(); prompt.status(config().get('preferredAgent', 'codex'), 'idle'); } },
		terminal: openTerminal, reset: async () => { await reset(); prompt.reset(); }, folder: () => vscode.commands.executeCommand('workbench.action.files.openFolder'),
		flow: () => vscode.commands.executeCommand('wispr.openDesktop'), toggle: () => vscode.commands.executeCommand('wispr.toggleVoice'), refresh: refreshAccount
	});
	context.subscriptions.push(prompt, vscode.window.registerWebviewViewProvider('wispr.prompt', prompt, { webviewOptions: { retainContextWhenHidden: true } }));
	command('wispr.open', openPrompt);
	command('wispr.home', () => home.show());
	command('wispr.openTerminal', openTerminal);
	command('wispr.sendPrompt', async text => {
		if (text === undefined) { text = await vscode.window.showInputBox({ prompt: t('Dictate with official Wispr Flow or type an agent instruction') }); }
		if (typeof text !== 'string' || !text.trim() || text.length > 100000) { return; }
		await openPrompt();
		await ensureInput().submit(text);
	});
	command('wispr.openDesktop', async () => { if (!await launchDesktop()) { await vscode.env.openExternal(vscode.Uri.parse(official.download)); } });
	command('wispr.toggleVoice', async () => { enabled = !enabled; await context.globalState.update('wispr.voice.enabled', enabled); home.refresh(); await startWatcher(); });
	command('wispr.stopAgent', interrupt);
	command('wispr.signIn', login);
	command('wispr.newSession', async () => { await reset(); prompt.reset(); await openPrompt(); });
	command('wispr.configureHotkey', async () => {
		const value = await vscode.window.showInputBox({ prompt: t('Enter the same shortcut configured in official Wispr Flow (for example Copilot, Ctrl+Win or CapsLock)'), value: config().get('hotkey', 'Ctrl+Win'), validateInput: value => /^(?:Copilot(?: key| button)?|(?:Ctrl|Control|Win|Super|Alt|Shift|Space|CapsLock|F(?:[1-9]|1\d|2[0-4])|[A-Z0-9])(?:\+(?:Ctrl|Control|Win|Super|Alt|Shift|Space|CapsLock|F(?:[1-9]|1\d|2[0-4])|[A-Z0-9]))*)$/i.test(value.trim()) ? undefined : t('Use Copilot or key names joined by +.') });
		if (value) { await config().update('hotkey', value, vscode.ConfigurationTarget.Global); }
	});
	command('wispr.agentStatus', async () => {
		agents = undefined;
		const available = await listAgents();
		const summary = available.map(agent => `${agent.kind}: ${agent.authenticated ? t('CLI login detected') : t('sign-in required or unverified')}${agent.authMethod ? ` (${agent.authMethod})` : ''}`).join('\n');
		await vscode.window.showInformationMessage(summary || t('No supported coding CLI found.'));
	});
	command('wispr.connectContext', async () => { requireWorkspace(); registerContext(); await context.globalState.update('wispr.context.enabled', true); await vscode.commands.executeCommand('workbench.mcp.listServer'); });
	command('wispr.addSkill', async () => {
		const root = requireWorkspace();
		const skill = await vscode.window.showQuickPick(catalog.map(item => ({ label: item.title, description: item.description, id: item.id })), { placeHolder: t('Add an agent skill to this project') });
		if (!skill) { return; }
		const agent = choose(await listAgents(), config().get('preferredAgent', 'codex'));
		const relative = `${agent?.kind === 'claude' ? '.claude' : '.agents'}/skills/${skill.id}`;
		const target = vscode.Uri.joinPath(folder(), relative);
		let parent = path.dirname(target.fsPath);
		while (true) {
			try { const real = await fs.realpath(parent); const rel = path.relative(await fs.realpath(root), real); if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) { throw new Error(t('The skill destination escapes this workspace.')); } break; }
			catch (error) { if (error.code !== 'ENOENT') { throw error; } parent = path.dirname(parent); }
		}
		if (await vscode.window.showWarningMessage(t('Add {0} to {1}? Scripts do not run automatically.', skill.label, relative), { modal: true }, t('Add Skill')) === t('Add Skill')) { await vscode.workspace.fs.copy(vscode.Uri.joinPath(context.extensionUri, 'skills', skill.id), target, { overwrite: false }); }
	});
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('wispr.voice')) { home.refresh(); agents = undefined; void startWatcher().catch(error => { status.tooltip = error.message; }); } }));
	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => { home.refresh(); void startWatcher(); }));
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => { home.refresh(); void reset(); input?.cancel(); void startWatcher().catch(error => { status.tooltip = error.message; }); }));
	context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(event => {
		if (event.closed.some(tab => tab.input instanceof vscode.TabInputText) && vscode.window.tabGroups.all.every(group => group.tabs.length === 0)) { home.show(true); }
	}));
	context.subscriptions.push({ dispose: () => { watcherGeneration++; sessionGeneration++; watcher?.dispose(); connectingEngine?.dispose(); input?.dispose(); engine?.dispose(); terminal?.dispose(); } });
	if (context.globalState.get('wispr.context.enabled') === true) { registerContext(); }
	void refreshAccount().catch(error => prompt.error(error.message));
	void startWatcher().catch(error => { status.tooltip = error.message; updateStatus(t('Manual')); });
	if (vscode.window.tabGroups.all.every(group => group.tabs.length === 0)) { home.show(true); }
}
module.exports = { activate };
