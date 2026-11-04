/* Copyright (c) Microsoft Corporation. Licensed under the MIT License. */
'use strict';
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const draft = $('prompt');
let state, composing = false, capture, ignorePaste;
draft.value = vscode.getState()?.draft ?? '';
const send = type => vscode.postMessage({ type });
function save() { vscode.setState({ draft: draft.value }); $('send').disabled = !draft.value.trim(); }
const transcript = document.createElement('div');
transcript.id = 'voice-transcript'; transcript.setAttribute('aria-hidden', 'true');
draft.parentNode.insertBefore(transcript, draft);
const waves = document.createElement('div');
waves.id = 'voice-waves'; waves.setAttribute('aria-hidden', 'true');
for (let index = 0; index < 9; index++) { waves.append(document.createElement('i')); }
draft.parentNode.insertBefore(waves, transcript);
let lastWords = [];
function showTranscript(text) {
	const words = text.match(/\S+\s*/g)?.slice(0, 2000) ?? [];
	let shared = 0;
	while (shared < words.length && shared < lastWords.length && words[shared] === lastWords[shared]) { shared++; }
	while (transcript.children.length > shared) { transcript.lastChild.remove(); }
	for (let index = shared; index < words.length; index++) {
		const word = document.createElement('span'); word.textContent = words[index]; transcript.append(word);
	}
	lastWords = words;
	transcript.scrollTop = transcript.scrollHeight;
}
function focusDraft() { draft.focus({ preventScroll: true }); }
draft.addEventListener('input', () => {
	save();
	if (state?.stage === 'listening') { showTranscript(draft.value); }
	else { document.body.dataset.voice = 'idle'; }
});
draft.addEventListener('paste', event => {
	if (ignorePaste && Date.now() < ignorePaste.expires && event.clipboardData?.getData('text/plain').replace(/\r\n/g, '\n').trim() === ignorePaste.text) { event.preventDefault(); ignorePaste = undefined; }
});
draft.addEventListener('compositionstart', () => { composing = true; });
draft.addEventListener('compositionend', () => { composing = false; save(); });
draft.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !composing && !event.isComposing) { event.preventDefault(); submit(); } });
function submit() { if (!composing && draft.value.trim()) { vscode.postMessage({ type: 'submit', text: draft.value }); } }
$('composer').addEventListener('submit', event => { event.preventDefault(); submit(); });
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => send(button.dataset.action)));
$('recover').addEventListener('click', () => send(state?.error?.action ?? 'refresh'));
function elapsed() { $('elapsed').textContent = state?.startedAt && ['working', 'connecting'].includes(state.stage) ? `${Math.floor((Date.now() - state.startedAt) / 1000)}s` : ''; }
function render(next) {
	const newError = next.error?.details !== state?.error?.details;
	if (next.stage === 'listening' && state?.stage !== 'listening') {
		focusDraft(); capture = { value: draft.value, start: draft.selectionStart, end: draft.selectionEnd };
		document.body.dataset.voice = 'listening'; showTranscript('');
	}
	if (state?.stage === 'listening' && next.stage !== 'listening' && document.body.dataset.voice !== 'sent') { document.body.dataset.voice = 'idle'; }
	state = next;
	const busy = state.active || ['working', 'connecting'].includes(state.stage);
	document.body.dataset.busy = String(busy); document.body.dataset.failed = String(state.stage === 'failed');
	$('account').textContent = state.account;
	$('hotkey').textContent = state.hotkey;
	$('auto').textContent = state.labels.auto;
	$('auto').setAttribute('aria-pressed', String(state.autoSend));
	$('route').textContent = state.labels.route;
	$('send').firstChild.textContent = state.labels.send + ' ';
	$('stop').hidden = !busy;
	$('stage').textContent = state.labels.stages[state.stage] ?? state.stage;
	$('welcome').hidden = state.messages.length > 0;
	const activity = $('activity'), nearBottom = activity.scrollHeight - activity.scrollTop - activity.clientHeight < 70;
	// All agent/user content stays text. No markdown HTML or executable links.
	const list = $('messages');
	state.messages.forEach((message, index) => {
		let row = list.children[index];
		if (!row) { row = document.createElement('article'); row.className = `message ${message.role}`; row.append(document.createElement('strong'), document.createElement('pre')); list.append(row); }
		row.className = `message ${message.role}`;
		row.firstChild.textContent = message.role === 'user' ? state.labels.you : state.provider;
		if (row.lastChild.textContent !== message.text) { row.lastChild.textContent = message.text; }
	});
	while (list.children.length > state.messages.length) { list.lastChild.remove(); }
	if (nearBottom) { activity.scrollTop = activity.scrollHeight; }
	$('error').hidden = !state.error;
	if (state.error) { $('error-title').textContent = state.error.title; $('error-hint').textContent = state.error.hint; $('error-details').textContent = state.error.details; $('recover').textContent = state.labels.recover; }
	if (newError && state.error) { activity.scrollTop = $('error').offsetTop - activity.offsetTop; }
	elapsed();
}
window.addEventListener('message', event => {
	const message = event.data;
	if (message?.type === 'state') { render(message.state); }
	if (message?.type === 'focus') { focusDraft(); }
	if (message?.type === 'accepted' && draft.value === message.text) { draft.value = ''; save(); }
	if (message?.type === 'flowTranscript') {
		const text = message.text.replace(/\r\n/g, '\n');
		showTranscript(text); document.body.dataset.voice = 'sent';
		if (capture) { const inserted = capture.value.slice(0, capture.start) + text + capture.value.slice(capture.end); if (draft.value === inserted) { draft.value = capture.value; save(); } }
		ignorePaste = { text: text.trim(), expires: Date.now() + 2500 }; capture = undefined;
	}
});
save(); setInterval(elapsed, 1000); send('ready'); focusDraft();
