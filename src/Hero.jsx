/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useHeroMotion } from './useHeroMotion.js';
export default function Hero({ onSignIn, signedIn }) {
const root = useRef(null); const [enabled, toggle] = useHeroMotion(root);
return (<section id="home" className="vela-hero" ref={root} aria-labelledby="hero-title">
<div className="pastel-panel" data-tone="0">
<div className="pastel-glow" aria-hidden="true"></div>
<header className="vela-nav"><Link className="vela-brand" to="/#home"><span></span>Wispr <b>IDE</b></Link><nav aria-label="Main navigation"><Link to="/#features">Product <span>⌄</span></Link><Link to="/#workflow-title">Workflow <span>⌄</span></Link><Link to="/releases">Releases <span>↗</span></Link></nav><button className="outline-button" id="account-open" onClick={onSignIn}>{signedIn ? 'Your account' : 'Sign in'} <span>↗</span></button></header>
<div className="vela-content"><div className="vela-overline">YOUR VOICE. YOUR AGENTS. YOUR OWN WAY.</div>
<h1 id="hero-title"><span className="sr-only">Build in your flow.</span><span className="cycling-line" aria-hidden="true"><span className="candy-icon" data-shape="0"><span>✳</span></span><span id="cycling-word">Build</span></span><span className="fixed-line" aria-hidden="true">in your flow.</span></h1>
<div className="vela-action-row"><div className="vela-buttons"><Link className="outline-button primary-action" to="/releases">Get WHIF IDE <span>↗</span></Link><Link className="outline-button" to="/#try-it">Try your next idea <span>↘</span></Link></div><p>A familiar editor for ideas spoken out loud.<br />Bring your own Codex or Claude Code agent.<span className="powered-flow"><span>Powered by</span><svg viewBox="0 0 446 126" role="img" aria-label="Wispr Flow"><g fill="currentColor"><rect width="18" height="126" rx="9"/><rect x="27" y="57" width="18" height="47" rx="9"/><rect x="54" y="20" width="18" height="89" rx="9"/><rect x="81" y="57" width="18" height="47" rx="9"/><rect x="108" width="18" height="126" rx="9"/><text x="160" y="108" fontFamily="Helvetica, Arial, sans-serif" fontWeight="800" fontSize="126" letterSpacing="-8">Flow</text></g></svg></span></p></div>
</div><button className="motion-control" id="hero-motion" aria-pressed={enabled} onClick={toggle}>{enabled ? 'Pause motion Ⅱ' : 'Resume motion ▷'}</button>
</div>
<div className="foundation-strip"><svg className="strip-notch" viewBox="0 0 1440 62" preserveAspectRatio="none" aria-hidden="true"><path d="M0 62 H1062 C1092 62 1098 54 1116 34 C1138 9 1146 1 1178 1 H1440 V62 Z"/></svg><Link className="learn-hint" to="/#features">↓ Scroll to find your flow</Link><p className="strip-lead">Great things start<br />with your words.</p><div className="foundation-item"><strong>Voice + text</strong><span>Two ways to get started</span></div><div className="foundation-item"><strong>Your agents</strong><span>Codex &amp; Claude Code</span></div><div className="foundation-item"><strong>Code OSS</strong><span>Familiar, open foundations</span></div><svg className="sprout" viewBox="0 0 80 100" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M10 90h60M40 90V40M40 63C14 63 10 45 13 28c24 0 30 15 27 35ZM40 46C65 45 72 26 66 9 43 14 38 30 40 46Z"/></svg></div>
</section>);
}
