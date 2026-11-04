/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';

function plain(text) { return String(text).replace(/\x1b\][^\x07]*(?:\x07|$)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''); }
function normalize(text) { return text.replace(/\x1b\[20[01]~/g, '').replace(/\r\n/g, '\n').trim(); }

/** A native IDE terminal frontend to the owned agent session, with Flow paste de-duplication. */
class AgentTerminal {
	constructor(options) {
		this.options = options;
		this.buffer = '';
		this.sequence = undefined;
		this.held = [];
		this.seen = new Set();
		this.opened = false;
		this.beforeOpen = [];
	}
	open() { this.opened = true; this.options.write('\x1b[?2004h'); this.output('Wispr ID · Codex preferred\nUse your official Flow hotkey, or type a prompt and press Enter.\nNew Flow prompts steer the active Codex turn; Ctrl+C or /stop interrupts.\n/login signs in using the installed CLI. /help lists commands.\n\n> '); for (const text of this.beforeOpen) { this.output(text); } this.beforeOpen = []; }
	output(text) { if (!this.opened) { this.beforeOpen.push(text); return; } this.options.write(plain(text).replace(/\r?\n/g, '\r\n')); }
	arm(sequence) { if (this.sequence !== sequence) { this.flushHeld(); } this.sequence = sequence; this.options.onEvent?.({ type: 'listening' }); this.output('\n[Flow listening — official app]\n'); }
	cancel() { this.sequence = undefined; this.flushHeld(); this.options.onEvent?.({ type: 'cancelled' }); this.output('\n[Flow capture cancelled]\n> '); }
	flushHeld() {
		clearTimeout(this.pasteTimer);
		if (this.held.length) { const text = this.held.join(''); this.held = []; this.buffer += text; this.output(text + '\n[Paste retained. Press Enter to send manually.]\n'); }
	}
	async transcript(sequence, text) {
		if (this.sequence !== sequence || this.seen.has(sequence) || typeof text !== 'string' || !text.trim() || text.length > 100000) { return false; }
		this.seen.add(sequence);
		if (this.seen.size > 100) { this.seen.delete(this.seen.values().next().value); }
		const held = this.held.join(''); this.held = []; clearTimeout(this.pasteTimer);
		if (held && normalize(held) !== normalize(text)) { this.buffer += held; this.output('[Other typed text retained as a manual draft.]\n'); }
		this.sequence = undefined;
		this.ignorePaste = { text: normalize(text), expires: Date.now() + 2500 };
		this.options.onEvent?.({ type: 'flowTranscript', text });
		await this.submit(text);
		return true;
	}
	async handleInput(data) {
		if (data === '\x03') { await this.options.interrupt(); this.output('\n[Interrupt requested]\n> '); return; }
		const value = data.replace(/\x1b\[20[01]~/g, '');
		if (this.ignorePaste && Date.now() < this.ignorePaste.expires && normalize(value) === this.ignorePaste.text) { this.ignorePaste = undefined; return; }
		if (this.sequence !== undefined && value && !/^\x1b/.test(value)) {
			this.held.push(value);
			clearTimeout(this.pasteTimer);
			this.pasteTimer = setTimeout(() => { this.sequence = undefined; this.flushHeld(); }, 2500);
			return;
		}
		if (data === '\r' || data === '\n') { const text = this.buffer; this.buffer = ''; this.output('\n'); await this.submit(text); return; }
		if (data === '\x7f' || data === '\b') { this.buffer = Array.from(this.buffer).slice(0, -1).join(''); this.options.write('\b \b'); return; }
		if (/^\x1b/.test(data) && !/^\x1b\[200~/.test(data)) { return; }
		this.buffer += value;
		this.output(value);
	}
	async submit(text) {
		if (!text.trim()) { this.output('> '); return; }
		this.lastPrompt = text;
		if (/^\/(stop|interrupt)$/.test(text.trim()) || /^(stop|cancel current task)[.!]?$/i.test(text.trim())) { await this.options.interrupt(); this.output('[Interrupt requested]\n> '); return; }
		if (text.trim() === '/login') { await this.options.login(); return; }
		if (text.trim() === '/help') { this.output('/stop: interrupt · /login: CLI sign-in · /new: new owned session · /retry: retry last failed prompt\n> '); return; }
		if (text.trim() === '/new') { await this.options.reset(); this.output('[New session]\n> '); return; }
		if (text.trim() === '/retry') { text = this.failedPrompt ?? ''; if (!text) { this.output('No failed prompt to retry.\n> '); return; } }
		this.output(`\nYou: ${text}\n`);
		this.options.onEvent?.({ type: 'user', text });
		try { const disposition = await this.options.send(text); this.failedPrompt = undefined; this.options.onEvent?.({ type: 'sent', disposition }); this.output(`[${disposition}]\n`); }
		catch (error) { this.failedPrompt = text; this.options.onEvent?.({ type: 'error', message: error.message }); this.output(`[Not sent] ${error.message}\nUse /login, then /retry.\n> `); }
	}
	dispose() { clearTimeout(this.pasteTimer); }
}
module.exports = { AgentTerminal, plain, normalize };
