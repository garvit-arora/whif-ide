/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { randomBytes } = require('node:crypto');

const commands = Object.freeze({ build: 'wispr.open', folder: 'workbench.action.files.openFolder', login: 'wispr.signIn', configure: 'wispr.configureHotkey', flow: 'wispr.openDesktop', stop: 'wispr.stopAgent', account: 'wispr.agentStatus', keys: 'workbench.action.openGlobalKeybindings', trust: 'workbench.trust.manage' });

function describeWorkspace(api) {
	const folder = api.workspace.workspaceFolders?.find(item => item.uri.scheme === 'file');
	return { name: folder?.name || '', local: Boolean(folder), trusted: api.workspace.isTrusted, hotkey: api.workspace.getConfiguration('wispr.voice').get('hotkey', 'Ctrl+Win'), autoSend: api.workspace.getConfiguration('wispr.voice').get('autoSend', true) };
}

class HomeView {
	constructor(api, extensionUri, autoSend) { this.api = api; this.extensionUri = extensionUri; this.autoSend = autoSend; this.title = api.l10n.t('Wispr Home'); }
	show(preserveFocus = false) {
		if (this.panel) { this.panel.reveal(undefined, preserveFocus); this.refresh(); return; }
		const api = this.api;
		const root = api.Uri.joinPath(this.extensionUri, 'media');
		const panel = this.panel = api.window.createWebviewPanel('wispr.home', this.title, { viewColumn: api.ViewColumn.One, preserveFocus }, { enableScripts: true, localResourceRoots: [root] });
		const subscriptions = [];
		subscriptions.push(panel.webview.onDidReceiveMessage(message => { void this.receive(message).catch(error => api.window.showErrorMessage(error.message)); }));
		subscriptions.push(panel.onDidDispose(() => { if (this.panel === panel) { this.panel = undefined; } for (const subscription of subscriptions) { subscription.dispose(); } }));
		this.refresh();
	}
	async receive(message) {
		if (!message || typeof message.action !== 'string' || !Object.hasOwn(commands, message.action)) { return; }
		const state = describeWorkspace(this.api);
		let action = message.action;
		if (['build', 'login'].includes(action) && !state.local) { action = 'folder'; }
		else if (['build', 'login'].includes(action) && !state.trusted) { action = 'trust'; }
		await this.api.commands.executeCommand(commands[action]);
	}
	refresh() {
		if (this.panel) { const state = describeWorkspace(this.api); state.autoSend = this.autoSend?.() ?? state.autoSend; this.panel.webview.html = renderHome(this.panel.webview, this.api.Uri, this.api.Uri.joinPath(this.extensionUri, 'media'), state, this.api.l10n.t); }
	}
	dispose() { this.panel?.dispose(); this.panel = undefined; }
}

function renderHome(webview, Uri, root, state, t = value => value) {
	const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
	const label = value => escape(t(value));
	const nonce = randomBytes(24).toString('base64');
	const css = escape(webview.asWebviewUri(Uri.joinPath(root, 'home.css')));
	const script = escape(webview.asWebviewUri(Uri.joinPath(root, 'home.js')));
	const ready = state.local && state.trusted;
	const modifier = process.platform === 'darwin' ? '⌘' : 'Ctrl';
	const shortcut = (action, title, keys) => `<button class="shortcut" data-action="${action}"><span>${label(title)}</span><kbd>${escape(keys)}</kbd><span aria-hidden="true">↗</span></button>`;
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escape(webview.cspSource)}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${css}"></head><body><main>
<header><div class="brand"><span aria-hidden="true">〰</span> Wispr <span class="brand-light">IDE</span></div><button class="subtle" data-action="keys">${label('Keyboard Shortcuts')} ↗</button></header>
<section class="intro"><div class="eyebrow">${label('YOUR WORKSPACE. YOUR VOICE.')}</div><h1>${label('Big ideas.')}<br><span>${label('Start with a whisper.')}</span></h1><p>${ready ? label('Your project is open. Open Build, then press your official Wispr Flow hotkey and describe what you want to make.') : state.local ? label('Your project is open. Review workspace trust before allowing the agent to change files or run commands.') : label('A little introduction before your next big thing. Open a project folder, connect your agent, and let your voice lead the way.')}</p>
<div class="project"><span class="status-dot" aria-hidden="true"></span>${state.local ? escape(state.name) : label('No project folder selected')}<span>${ready ? label('Local project') : state.local ? label('Trust required') : label('Choose where your ideas will live')}</span></div>
<div class="actions"><button class="primary" data-action="${ready ? 'build' : state.local ? 'trust' : 'folder'}">${ready ? label('Open Build') : state.local ? label('Review Workspace Trust') : label('Open Project Folder')} ↗</button><button class="secondary" data-action="login">${label('Connect Your Agent')}</button></div></section>
<section class="voice-card" aria-labelledby="voice-title"><div class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div><h2 id="voice-title">${label('Your voice has a shortcut.')}</h2><p>${label('Press your Wispr Flow hotkey to dictate. Verified captures are sent to your installed agent automatically when auto-send is on.')}</p><div class="hotkey"><kbd>${escape(state.hotkey)}</kbd><button data-action="configure" class="subtle">${label('Change Shortcut')} ↗</button></div><p class="fine">${ready ? label('Keep official Wispr Flow running. Its configured shortcut must match this one.') : label('First open and trust a local folder to enable automatic agent routing.')} ${state.autoSend ? '' : label('Auto-send is paused in settings.')}</p><button class="subtle" data-action="flow">${label('Open Official Wispr Flow')} ↗</button></div></section>
<section class="getting-started" aria-label="${label('Getting started')}"><article><span>01</span><h3>${label('Choose a project')}</h3><p>${label('Open a local folder. The agent works inside the trusted workspace you choose.')}</p><button data-action="folder" class="subtle">${label('Open Folder')} ↗</button></article><article><span>02</span><h3>${label('Bring your account')}</h3><p>${label('Sign in through your installed Codex or Claude Code. Provider access and usage limits still apply.')}</p><button data-action="account" class="subtle">${label('Check Agent Account')} ↗</button></article><article><span>03</span><h3>${label('Say it. Shape it.')}</h3><p>${label('Dictate with Flow. Follow up to change direction. Review approvals, code changes and tests.')}</p><button data-action="build" class="subtle">${label('Open Build')} ↗</button></article></section>
<section class="shortcuts"><div class="section-heading"><h2>${label('A few keys. A lot less friction.')}</h2><span>${label('Default shortcuts · customize in Keyboard Shortcuts')}</span></div>${shortcut('build', 'Open Voice and Text Build', modifier + '+Alt+W')}${shortcut('configure', 'Configure Flow Shortcut', modifier + '+Alt+Shift+W')}${shortcut('stop', 'Interrupt the Active Agent', modifier + '+Alt+Escape')}${shortcut('folder', 'Open a Project Folder', modifier + '+K ' + modifier + '+O')}<div class="home-key">${label('Return here anytime')} <kbd>${escape(modifier)}+Alt+H</kbd></div></section>
<footer>${label('Official Flow handles dictation. Your installed agent handles execution. You stay in control.')}</footer>
</main><script nonce="${nonce}" src="${script}"></script></body></html>`;
}

module.exports = { HomeView, describeWorkspace, renderHome };
