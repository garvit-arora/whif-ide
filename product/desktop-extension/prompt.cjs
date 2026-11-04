/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { randomBytes } = require('node:crypto');

function recovery(message, t = value => value) {
	if (/sign(?:ed)?[ -]?in|logged.?in|auth|401|403/i.test(message)) { return { title: t('One quick sign-in, then you’re ready'), hint: t('Your prompt is saved. Connect the installed coding agent to your account, then retry.'), action: 'login' }; }
	if (/quota|rate.?limit|429|credit|billing/i.test(message)) { return { title: t('Your agent needs a little breathing room'), hint: t('Check your account limits or credits, then retry when access is available.'), action: 'retry' }; }
	if (/workspace|folder|trust/i.test(message)) { return { title: t('Let’s choose a place to build'), hint: t('Open a local project folder and trust it before running coding instructions.'), action: 'folder' }; }
	return { title: t('A small detour. Your prompt is safe.'), hint: t('Check the connection details below. Reconnect and retry when you’re ready.'), action: 'retry' };
}

class PromptView {
	constructor(api, options) {
		this.api = api; this.options = options; this.t = api.l10n.t;
		this.state = { stage: 'idle', active: false, provider: 'Codex', account: this.t('Checking the installed account…'), hotkey: options.hotkey(), autoSend: options.autoSend(), messages: [], error: null, startedAt: null };
	}
	resolveWebviewView(view) {
		this.messages?.dispose(); this.disposal?.dispose();
		this.view = view;
		const root = this.api.Uri.joinPath(this.options.extensionUri, 'media');
		view.webview.options = { enableScripts: true, localResourceRoots: [root] };
		view.webview.html = renderPrompt(view.webview, this.api.Uri, root, this.t);
		this.messages = view.webview.onDidReceiveMessage(message => { void this.receive(message).catch(error => this.error(error.message)); });
		this.disposal = view.onDidDispose(() => { this.messages?.dispose(); this.disposal?.dispose(); this.view = undefined; });
		this.publish();
	}
	async receive(message) {
		if (!message || typeof message !== 'object') { return; }
		if (message.type === 'ready') { this.publish(); if (this.pendingFocus) { this.focus(); } return; }
		if (message.type === 'submit') {
			if (typeof message.text !== 'string' || !message.text.trim() || message.text.length > 100000) { return; }
			await this.options.submit(message.text); return;
		}
		const actions = { stop: this.options.stop, login: this.options.login, retry: this.options.retry, terminal: this.options.terminal, reset: this.options.reset, folder: this.options.folder, flow: this.options.flow, toggle: this.options.toggle, refresh: this.options.refresh };
		if (Object.hasOwn(actions, message.type)) { await actions[message.type](); }
	}
	account(agents) {
		const preferred = agents.find(item => item.kind === 'codex');
		this.state.account = preferred?.authenticated ? this.t('Existing Codex login detected') : preferred ? this.t('Codex needs sign-in · existing login checked') : this.t('Install Codex to connect your account');
		this.publish();
	}
	configure() { this.state.hotkey = this.options.hotkey(); this.state.autoSend = this.options.autoSend(); this.publish(); }
	connected(kind) { this.state.provider = kind === 'claude' ? 'Claude Code' : 'Codex'; this.state.account = this.t('Connected with the installed {0} account', this.state.provider); this.publish(); }
	status(provider, stage) {
		this.state.provider = provider === 'claude' ? 'Claude Code' : 'Codex';
		this.state.active = stage === 'working';
		if (stage === 'ready') { if (this.state.stage !== 'connecting') { this.state.stage = 'idle'; } }
		else { this.state.stage = stage; }
		if (stage === 'working' && !this.state.startedAt) { this.state.startedAt = Date.now(); }
		this.publish();
	}
	event(event) {
		if (event.type === 'flowTranscript') { void this.view?.webview.postMessage({ type: 'flowTranscript', text: event.text }); return; }
		if (event.type === 'user') {
			this.state.messages.push({ role: 'user', text: event.text }); this.trim();
			this.state.error = null; this.state.stage = 'connecting'; this.state.startedAt = Date.now();
			void this.view?.webview.postMessage({ type: 'accepted', text: event.text });
		}
		if (event.type === 'listening') { if (this.state.stage !== 'listening') { this.beforeListening = this.state.stage; } this.state.stage = 'listening'; }
		if (event.type === 'cancelled') { this.state.stage = this.beforeListening ?? 'idle'; this.beforeListening = undefined; }
		if (event.type === 'sent') { if (!['completed', 'failed', 'interrupted'].includes(this.state.stage)) { this.state.stage = 'working'; } }
		if (event.type === 'error') { this.error(event.message); return; }
		this.publish();
	}
	append(text) {
		const last = this.state.messages.at(-1);
		if (last?.role === 'assistant') { last.text += text; }
		else { this.state.messages.push({ role: 'assistant', text }); }
		this.trim();
		if (!this.timer) { this.timer = setTimeout(() => { this.timer = undefined; this.publish(); }, 60); }
	}
	trim() {
		while (this.state.messages.length > 80 || (this.state.messages.length > 1 && this.state.messages.reduce((sum, item) => sum + item.text.length, 0) > 150000)) { this.state.messages.shift(); }
		for (const item of this.state.messages) { if (item.text.length > 100000) { item.text = item.text.slice(-100000); } }
	}
	error(message) { this.state.stage = 'failed'; this.state.error = { ...recovery(String(message), this.t), details: String(message) }; this.publish(); }
	reset() { this.state.messages = []; this.state.stage = 'idle'; this.state.active = false; this.state.error = null; this.state.startedAt = null; this.beforeListening = undefined; this.publish(); }
	focus() { this.pendingFocus = true; void this.view?.webview.postMessage({ type: 'focus' }); }
	publish() {
		const t = this.t;
		const busy = this.state.active || ['working', 'connecting'].includes(this.state.stage);
		this.state.labels = { auto: this.state.autoSend ? t('Flow auto-send on') : t('Flow auto-send paused'), route: t('Flow → {0} · existing CLI account', this.state.provider), send: busy ? t('Steer task') : t('Run with {0}', this.state.provider), you: t('You'),
			recover: this.state.error?.action === 'login' ? t('Sign in with existing account') : this.state.error?.action === 'folder' ? t('Open folder') : t('Reconnect and retry'),
			stages: { idle: t('Ready when you are'), connecting: t('Connecting to your installed agent…'), listening: t('Listening through official Flow. Finish dictating to run.'), working: t('{0} is working. You can change direction anytime.', this.state.provider), completed: t('Done. Your next idea can start here.'), interrupted: t('Stopped. Tell me what to change.'), failed: t('Let’s get you moving again.'), disconnected: t('Agent disconnected. Reconnect to continue.') }
		};
		void this.view?.webview.postMessage({ type: 'state', state: this.state });
	}
	dispose() { clearTimeout(this.timer); this.messages?.dispose(); this.disposal?.dispose(); }
}

function renderPrompt(webview, Uri, root, t = value => value) {
	const nonce = randomBytes(24).toString('base64');
	const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
	const label = value => escape(t(value));
	const css = escape(webview.asWebviewUri(Uri.joinPath(root, 'prompt.css')));
	const script = escape(webview.asWebviewUri(Uri.joinPath(root, 'prompt.js')));
	return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escape(webview.cspSource)}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${css}"></head><body>
<main>
<header><div class="identity"><span class="mark" aria-hidden="true">〰</span><div><strong>${label('Build with your voice')}</strong><span id="account"></span></div></div><nav aria-label="${label('Agent controls')}"><button data-action="refresh" class="quiet">${label('Check account')}</button><button data-action="terminal" class="quiet">${label('Terminal')}</button><button data-action="reset" class="quiet">${label('New session')}</button></nav></header>
<section id="activity" aria-label="${label('Agent activity')}"><div id="welcome"><svg viewBox="0 0 260 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="60" height="54" rx="6"/><path d="M18 26v10m7-17v24m7-29v34m7-29v24m7-17v10M74 31h35m-6-6 6 6-6 6"/><rect x="122" y="4" width="60" height="54" rx="6"/><path d="m143 22-9 9 9 9m17-18 9 9-9 9m-8-20-5 26M194 31h20m-6-6 6 6-6 6"/><circle cx="239" cy="31" r="18"/><path d="m231 31 6 6 11-13"/></g></svg><div><h1>${label('Say it. Shape it. Build it.')}</h1><p>${label('Describe what you want to make. Follow up anytime to change direction.')}</p></div></div><div id="messages" role="log" aria-label="${label('Conversation')}"></div>
<section id="error" role="alert" hidden><div class="error-heading"><span aria-hidden="true">↪</span><strong id="error-title"></strong></div><p id="error-hint"></p><div class="error-actions"><button id="recover">${label('Reconnect')}</button><button data-action="retry" class="quiet">${label('Retry prompt')}</button><details><summary>${label('Technical details')}</summary><pre id="error-details"></pre></details></div></section></section>
<form id="composer"><div class="draft-label"><label for="prompt">${label('Your next instruction')}</label><span id="route"></span></div><textarea id="prompt" rows="4" maxlength="100000" placeholder="${label('What would you like to build? Dictate with Flow or type here…')}" aria-describedby="input-help" spellcheck="false"></textarea><footer><div id="input-help"><kbd id="hotkey">Copilot</kbd><span>${label('to dictate')}</span><button type="button" id="auto" data-action="toggle" class="quiet"></button></div><div class="send-actions"><button type="button" id="stop" data-action="stop" class="quiet" hidden>${label('Stop')}</button><button type="submit" id="send">${label('Run with Codex')} <span aria-hidden="true">↗</span></button></div></footer></form>
<div class="status-row" role="status" aria-live="polite"><span id="stage-dot"></span><span id="stage">${label('Ready when you are')}</span><span id="elapsed"></span><button data-action="flow" class="quiet">${label('Open Flow')}</button><span class="keyboard-hint">${label('Ctrl+Enter to run · Shift+Enter for a new line')}</span></div>
</main><script nonce="${nonce}" src="${script}"></script></body></html>`;
}
module.exports = { PromptView, recovery, renderPrompt };
