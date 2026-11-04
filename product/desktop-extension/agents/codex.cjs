/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const { spawn } = require('node:child_process');
const readline = require('node:readline');

/** Official Codex app-server over owned stdio. Prompts are JSON data, never shell command text. */
class CodexSession {
	constructor(options) {
		this.options = options;
		this.pending = new Map();
		this.nextId = 1;
		this.turnId = undefined;
		this.threadId = undefined;
		this.starting = undefined;
		this.closed = false;
		this.completedTurns = new Set();
	}
	async connect() {
		if (this.connection) { return this.connection; }
		this.connection = this.initialize();
		return this.connection;
	}
	async initialize() {
		this.child = (this.options.spawn ?? spawn)(this.options.executable, ['app-server', '--stdio'], { cwd: this.options.cwd, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
		this.child.on('error', error => this.fail(error));
		this.child.on('exit', () => this.fail(new Error('Codex process ended. Reopen the agent terminal to reconnect.')));
		this.child.stdin.on('error', error => this.fail(error));
		this.child.stderr.on('data', () => {}); // Provider diagnostics may contain account details; do not echo them.
		this.lines = readline.createInterface({ input: this.child.stdout });
		this.lines.on('line', line => { try { void this.receive(JSON.parse(line)).catch(error => this.fail(error)); } catch { } });
		await this.rpc('initialize', { clientInfo: { name: 'wispr_id', title: 'Wispr ID', version: '0.6.0' }, capabilities: { experimentalApi: Boolean(this.options.ideTools) } });
		this.write({ method: 'initialized', params: {} });
		const status = await this.rpc('account/read', { refreshToken: false });
		if (!status.account && status.requiresOpenaiAuth !== false) { throw new Error('Codex CLI is not signed in. Run “Wispr ID: Sign In to Coding Agent” to use your existing account.'); }
		const catalog = await this.rpc('model/list', { includeHidden: false, limit: 100 });
		const models = (catalog.data ?? []).filter(item => !item.hidden && typeof item.model === 'string');
		this.options.onModels?.(models.map(item => ({ model: item.model, isDefault: item.isDefault })));
		const requested = this.options.model;
		const selected = requested ? models.find(item => item.model === requested) : models.find(item => item.isDefault) ?? models[0];
		if (requested && !selected) {
			const error = new Error(`The installed Codex CLI does not advertise ${requested} for this account. Update Codex or choose an advertised model in wispr.voice.model. Available: ${models.map(item => item.model).join(', ') || 'none'}. No other model was substituted.`);
			error.code = 'WISPR_MODEL_UNAVAILABLE'; throw error;
		}
		if (!selected) { throw new Error('Codex did not advertise an available model for this account. Check its account and provider settings.'); }
		this.model = selected.model;
		this.effort = this.options.reasoningEffort;
		if (this.effort && !selected.supportedReasoningEfforts?.some(item => item.reasoningEffort === this.effort)) {
			const error = new Error(`Codex does not advertise ${this.effort} reasoning effort for ${this.model}. Choose a supported effort in wispr.voice.reasoningEffort.`);
			error.code = 'WISPR_MODEL_UNAVAILABLE'; throw error;
		}
		this.options.onModel?.(this.model);
		const thread = await this.rpc('thread/start', { cwd: this.options.cwd, model: this.model, approvalPolicy: 'on-request', sandbox: 'workspace-write', ...(this.options.ideTools ? { dynamicTools: this.options.ideTools.definitions } : {}) });
		this.threadId = thread.thread.id;
		this.options.onStatus?.('ready');
	}
	write(message) {
		if (this.closed || this.disconnected || !this.child?.stdin.writable) { throw new Error('Codex is disconnected. Use /new to reconnect.'); }
		this.child.stdin.write(JSON.stringify(message) + '\n');
	}
	rpc(method, params) {
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codex ${method} timed out.`)); }, 30000);
			this.pending.set(id, { resolve, reject, timer });
			try { this.write({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
		});
	}
	async receive(message) {
		if (message.id !== undefined && !message.method) {
			const waiting = this.pending.get(message.id);
			if (waiting) { clearTimeout(waiting.timer); this.pending.delete(message.id); message.error ? waiting.reject(new Error(message.error.message ?? 'Codex request failed.')) : waiting.resolve(message.result); }
			return;
		}
		if (message.id !== undefined && message.method) {
			try {
				if (message.method === 'item/tool/call') {
					if (!this.options.ideTools || !this.options.ideTools.definitions.some(tool => tool.name === message.params.tool)) { throw new Error('Unsupported IDE tool'); }
					try {
						const result = await this.options.ideTools.call(message.params.tool, message.params.arguments);
						this.write({ id: message.id, result: { success: true, contentItems: [{ type: 'inputText', text: JSON.stringify(result) }] } });
					} catch (error) { this.write({ id: message.id, result: { success: false, contentItems: [{ type: 'inputText', text: error.message }] } }); }
				} else if (/requestApproval$/.test(message.method)) {
					const approved = await this.options.approve(message.method, message.params);
					this.write({ id: message.id, result: { decision: approved ? 'accept' : 'decline' } });
				} else if (message.method === 'item/tool/requestUserInput') {
					this.write({ id: message.id, result: { answers: await this.options.questions(message.params.questions ?? []) } });
				} else { this.write({ id: message.id, error: { code: -32601, message: 'This host does not support that interactive request.' } }); }
			} catch { if (!this.closed) { this.write({ id: message.id, error: { code: -32000, message: 'Request cancelled by host.' } }); } }
			return;
		}
		const data = message.params ?? {};
		if (message.method === 'turn/started') { this.turnId = data.turn.id; this.options.onStatus?.('working'); }
		if (message.method === 'turn/completed') {
			this.completedTurns.add(data.turn.id);
			if (this.completedTurns.size > 32) { this.completedTurns.delete(this.completedTurns.values().next().value); }
			if (this.turnId === data.turn.id) { this.turnId = undefined; }
			this.options.onOutput?.(`\n[${data.turn.status}]\n`);
			this.options.onStatus?.(data.turn.status);
			if (data.turn.error?.message) { this.options.onError?.(data.turn.error.message); }
		}
		if (message.method === 'item/agentMessage/delta' || message.method === 'item/commandExecution/outputDelta') { this.options.onOutput?.(data.delta ?? ''); }
		if (message.method === 'item/started' && data.item?.type === 'commandExecution') { this.options.onOutput?.(`\n$ ${data.item.command ?? 'Running command'}\n`); }
		if (message.method === 'error') { const message = data.error?.message ?? data.message ?? 'Request failed'; this.options.onOutput?.(`\n[Codex error] ${message}\n`); this.options.onError?.(message); }
	}
	async send(text) {
		await this.connect();
		if (this.starting) { await this.starting; }
		if (this.turnId) {
			const expectedTurnId = this.turnId;
			try {
				await this.rpc('turn/steer', { threadId: this.threadId, expectedTurnId, input: [{ type: 'text', text }] });
				return 'steered';
			} catch (error) { if (this.turnId === expectedTurnId && !/no active turn|turn.*not.*active|turn.*mismatch/i.test(error.message)) { throw error; } this.turnId = undefined; }
		}
		this.starting = this.rpc('turn/start', { threadId: this.threadId, model: this.model, ...(this.effort ? { effort: this.effort } : {}), input: [{ type: 'text', text }] }).then(result => { this.turnId = this.completedTurns.has(result.turn.id) ? undefined : result.turn.id; this.options.onStatus?.(this.turnId ? 'working' : 'ready'); });
		try { await this.starting; } finally { this.starting = undefined; }
		return 'started';
	}
	async interrupt() {
		if (this.starting) { await this.starting; }
		if (this.turnId) { await this.rpc('turn/interrupt', { threadId: this.threadId, turnId: this.turnId }); }
	}
	fail(error) {
		if (this.closed) { return; }
		for (const waiting of this.pending.values()) { clearTimeout(waiting.timer); waiting.reject(error); }
		this.pending.clear();
		this.disconnected = true;
		this.turnId = undefined;
		this.options.onStatus?.('disconnected');
	}
	dispose() {
		this.fail(new Error('Codex session closed.'));
		this.closed = true;
		this.lines?.close();
		this.child?.kill();
	}
}
module.exports = { CodexSession };
