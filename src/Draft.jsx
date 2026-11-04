/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { useRef, useState } from 'react';

export default function Draft() {
	const [text, setText] = useState('');
	const [status, setStatus] = useState('Nothing is sent to a provider from this page.');
	const input = useRef(null);
	async function copy() {
		if (!text.trim()) { setStatus('Add an instruction first.'); input.current.focus(); return; }
		try { await navigator.clipboard.writeText(text); setStatus('Copied. Paste into the desktop Build panel to run with your agent.'); }
		catch { input.current.focus(); input.current.select(); setStatus('Automatic copy is unavailable. Press Ctrl+C or use your device’s Copy action.'); }
	}
	return <section id="try-it" className="draft-section" aria-labelledby="draft-title"><div className="section-top"><span>YOUR NEXT IDEA / START HERE</span><span>WORDS FIRST. POSSIBILITIES NEXT.</span></div><div className="draft-layout"><div><span className="story-kicker">Say it before you forget it.</span><h2 id="draft-title">Make space<br />for the next thought.</h2><p>Click the prompt and type, paste, or dictate using your installed Wispr Flow app and its own shortcut. This is a local draft, not a connected agent session.</p><p>To run it, copy your instruction into the desktop client's Build panel. Its verified Flow integration and agent approvals stay in the desktop client.</p></div><div className="draft-card"><label htmlFor="idea-input">YOUR INSTRUCTION</label><textarea ref={input} id="idea-input" rows="6" placeholder="Build a little tool that turns my ideas into a plan…" maxLength={20000} value={text} onChange={event => { setText(event.target.value); setStatus('Nothing is sent to a provider from this page.'); }} /><div className="draft-actions"><span id="draft-count">{text.length} characters · not saved</span><button className="outline-button" id="copy-idea" onClick={copy}>Copy for your agent ↗</button></div><p id="draft-status" role="status">{status}</p></div></div></section>;
}
