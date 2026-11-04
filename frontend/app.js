/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
'use strict';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
window.addEventListener('hashchange', updateNavigation);
function updateNavigation() {
	for (const link of document.querySelectorAll('[data-route]')) {
		const active = link.hash === (location.hash || '#home');
		link.classList.toggle('active', active);
		if (active) { link.setAttribute('aria-current', 'location'); } else { link.removeAttribute('aria-current'); }
	}
}
updateNavigation();
const panel = document.querySelector('.pastel-panel');
const word = document.querySelector('#cycling-word');
const icon = document.querySelector('.candy-icon');
const motionButton = document.querySelector('#hero-motion');
const words = ['Build', 'Speak', 'Shape', 'Create'];
const symbols = ['✳', '●', '✦', '◎'];
const clock = panel.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 7000, iterations: Infinity });
let motionEnabled = !reducedMotion.matches;
let animationFrame = 0;
let lastSlot = -1;
function drawHero() {
	const elapsed = Number(clock.currentTime || 0) % 7000;
	const slot = Math.floor(elapsed / 1750);
	const phase = elapsed % 1750;
	if (slot !== lastSlot) {
		word.textContent = words[slot];
		icon.firstElementChild.textContent = symbols[slot];
		icon.dataset.shape = String(slot);
		panel.dataset.tone = String(slot);
		lastSlot = slot;
	}
	const enter = Math.min(1, phase / 500);
	const leave = Math.max(0, (phase - 1330) / 420);
	const eased = 1 - Math.pow(1 - enter, 3);
	word.style.opacity = String(eased * (1 - leave ** 3));
	word.style.transform = `translateY(${(1 - eased) * .32 - leave ** 3 * .16}em)`;
	word.style.filter = `blur(${(1 - eased) * 10 + leave ** 3 * 8}px)`;
	const iconEnter = Math.min(1, Math.max(0, (phase - 60) / 440));
	icon.style.opacity = String(iconEnter * (1 - leave ** 3));
	icon.style.transform = `translateY(${Math.sin(elapsed / 900) * .028}em) scale(${.7 + .3 * iconEnter}) rotate(${-14 * (1 - iconEnter) + Math.sin(elapsed / 800) * 3}deg)`;
	if (motionEnabled && !document.hidden) { animationFrame = requestAnimationFrame(drawHero); }
}
function syncHeroMotion() {
	cancelAnimationFrame(animationFrame);
	if (motionEnabled && !document.hidden) { clock.play(); drawHero(); }
	else {
		clock.pause();
		if (!motionEnabled) {
			word.textContent = 'Build'; icon.firstElementChild.textContent = symbols[0];
			icon.dataset.shape = '0'; panel.dataset.tone = '0'; lastSlot = -1;
			for (const node of [word, icon]) { node.style.opacity = '1'; node.style.transform = 'none'; node.style.filter = 'none'; }
		}
	}
	motionButton.setAttribute('aria-pressed', String(motionEnabled));
	motionButton.textContent = motionEnabled ? 'Pause motion Ⅱ' : 'Resume motion ▷';
}
motionButton.addEventListener('click', () => { motionEnabled = !motionEnabled; syncHeroMotion(); });
document.addEventListener('visibilitychange', syncHeroMotion);
reducedMotion.addEventListener('change', () => { motionEnabled = !reducedMotion.matches; syncHeroMotion(); });
syncHeroMotion();
const accountDialog = document.querySelector('#account-dialog');
document.querySelector('#account-open').addEventListener('click', () => accountDialog.showModal());
document.querySelector('#account-close').addEventListener('click', () => accountDialog.close());
document.querySelector('#account-draft').addEventListener('click', () => accountDialog.close());
const accountStatus = document.querySelector('#google-status');
async function refreshAccount() {
	try {
		const response = await fetch('/api/session', { cache: 'no-store' });
		if (!response.ok) { throw new Error('Unavailable'); }
		const session = await response.json();
		const signIn = document.querySelector('#google-login');
		signIn.hidden = Boolean(session.user) || !session.configured;
		document.querySelector('#google-logout').hidden = !session.user;
		accountStatus.textContent = session.user ? `Signed in as ${session.user.name} (${session.user.email}). This is your website account, not your agent connection.` : session.configured ? 'Sign in with Google to create your website session.' : 'Google login needs server configuration. No account has been connected.';
		document.querySelector('#account-open').textContent = session.user ? 'Your account ↗' : 'Sign in ↗';
		const authResult = new URL(location.href).searchParams.get('auth');
		if (authResult) {
			if (authResult === 'failed') { accountStatus.textContent = 'Google sign-in was cancelled or could not be verified. Please try again.'; }
			accountDialog.showModal();
			const clean = new URL(location.href); clean.searchParams.delete('auth'); history.replaceState(null, '', clean);
		}
	} catch { accountStatus.textContent = 'The account service is unavailable. Run the website with its Node server to use login.'; }
}
document.querySelector('#google-logout').addEventListener('click', async () => {
	try {
		const response = await fetch('/auth/logout', { method: 'POST', headers: { 'X-Wispr-Request': 'logout' } });
		if (!response.ok) { throw new Error('Sign-out failed'); }
		await refreshAccount();
	} catch { accountStatus.textContent = 'Could not sign out. Please retry.'; }
});
refreshAccount();
const ideaInput = document.querySelector('#idea-input');
const draftStatus = document.querySelector('#draft-status');
ideaInput.addEventListener('input', () => {
	document.querySelector('#draft-count').textContent = `${ideaInput.value.length} characters · not saved`;
	draftStatus.textContent = 'Nothing is sent to a provider from this page.';
});
document.querySelector('#copy-idea').addEventListener('click', async () => {
	if (!ideaInput.value.trim()) { draftStatus.textContent = 'Add an instruction first.'; ideaInput.focus(); return; }
	try { await navigator.clipboard.writeText(ideaInput.value); draftStatus.textContent = 'Copied. Paste into the desktop Build panel to run with your agent.'; }
	catch { ideaInput.focus(); ideaInput.select(); draftStatus.textContent = 'Automatic copy is unavailable. Press Ctrl+C or use your device’s Copy action.'; }
});
