/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { pathToFileURL } = require('node:url');

/** Use the official SDK with the installed CLI and its existing login, not a new API-key flow. */
class ClaudeSession {
	constructor(options) { this.options = options; this.items = []; this.waiter = undefined; this.working = false; this.closed = false; }
	async connect() {
		if (this.connection) { return this.connection; }
		this.connection = this.initialize();
		return this.connection;
	}
	async initialize() {
		const sdk = await (this.options.loadSdk?.() ?? import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')).href));
		const self = this;
		async function* input() {
			while (!self.closed) {
				if (!self.items.length) { await new Promise(resolve => { self.waiter = resolve; }); }
				while (self.items.length) { yield self.items.shift(); }
			}
		}
		this.query = sdk.query({ prompt: input(), options: {
			cwd: this.options.cwd, pathToClaudeCodeExecutable: this.options.executable,
			permissionMode: 'default', includePartialMessages: true,
			maxTurns: this.options.maxTurns, maxBudgetUsd: this.options.maxBudgetUsd,
			canUseTool: async (name, value) => await this.options.approve(name, value) ? { behavior: 'allow', updatedInput: value } : { behavior: 'deny', message: 'User denied this action.' }
		} });
		let timer;
		try { await Promise.race([this.query.initializationResult(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Claude CLI initialization timed out. Check its login and provider settings.')), 30000); })]); }
		finally { clearTimeout(timer); }
		void this.read().catch(error => { if (!this.closed) { this.options.onOutput?.(`\n[Claude error] ${error.message}\n`); } }).finally(() => {
			this.disconnected = true; this.working = false; this.finishTurn?.(); this.finishTurn = undefined;
			if (!this.closed) { this.options.onStatus?.('disconnected'); }
		});
		this.options.onStatus?.('ready');
	}
	async read() {
		for await (const message of this.query) {
			if (message.type === 'stream_event') {
				const delta = message.event?.delta;
				if (delta?.type === 'text_delta') { this.options.onOutput?.(delta.text); }
			}
			if (message.type === 'result') { this.working = false; this.finishTurn?.(); this.finishTurn = undefined; this.options.onOutput?.(`\n[${message.subtype}]\n`); if (message.is_error) { const details = message.result ?? message.errors?.join('\n') ?? 'Provider request failed.'; this.options.onOutput?.(details); this.options.onError?.(details); } this.options.onStatus?.(message.is_error ? 'failed' : 'completed'); }
		}
	}
	async send(text) {
		// Serialize only control handshakes, never wait for a task to finish normally.
		const operation = (this.control ?? Promise.resolve()).then(() => this.sendNow(text));
		this.control = operation.catch(() => {});
		return operation;
	}
	async sendNow(text) {
		await this.connect();
		if (this.closed || this.disconnected) { throw new Error('Claude is disconnected. Use /new to reconnect.'); }
		const interrupted = this.working;
		if (interrupted) {
			await this.query.interrupt();
			let timer;
			try { await Promise.race([this.turnFinished, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Claude did not acknowledge interruption; the new prompt was not queued.')), 10000); })]); }
			finally { clearTimeout(timer); }
		}
		if (this.closed || this.disconnected) { throw new Error('Claude is disconnected. Use /new to reconnect.'); }
		this.working = true;
		this.turnFinished = new Promise(resolve => { this.finishTurn = resolve; });
		this.items.push({ type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null });
		this.waiter?.(); this.waiter = undefined;
		this.options.onStatus?.('working');
		return interrupted ? 'interrupted-and-steered' : 'started';
	}
	async interrupt() { if (this.query && this.working) { await this.query.interrupt(); } }
	dispose() { this.closed = true; this.finishTurn?.(); this.waiter?.(); this.query?.close(); }
}
module.exports = { ClaudeSession };
