/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
'use strict';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const status = document.querySelector('#release-status');
let releases = [];
function safeUrl(value) {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && ['github.com', 'objects.githubusercontent.com'].includes(url.hostname) && !url.username && !url.password ? url.href : null;
	} catch { return null; }
}
function renderReleases() {
	const search = document.querySelector('#release-search').value.toLowerCase();
	const channel = document.querySelector('#release-channel').value;
	const list = document.querySelector('#release-list');
	list.replaceChildren();
	const filtered = releases.filter(release => (channel === 'all' || Boolean(release.prerelease) === (channel === 'preview')) && `${release.name} ${release.tag_name} ${release.body}`.toLowerCase().includes(search));
	status.textContent = releases.length ? `${filtered.length} release${filtered.length === 1 ? '' : 's'} found.` : 'The cabinet is ready. The first public release is still on its way. Come back here for verified downloads and release notes.';
	for (const release of filtered) {
		const article = document.createElement('article');
		article.className = 'release-card';
		const title = document.createElement('h3');
		title.textContent = release.name || release.tag_name || 'Release';
		const metadata = document.createElement('small');
		const date = new Date(release.published_at);
		metadata.textContent = `${release.prerelease ? 'Preview' : 'Stable'} · ${release.tag_name || ''} · ${Number.isNaN(date.valueOf()) ? 'Date not provided' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
		const notes = document.createElement('p');
		notes.textContent = typeof release.body === 'string' ? release.body : '';
		article.append(title, metadata, notes);
		for (const asset of Array.isArray(release.assets) ? release.assets : []) {
			const href = safeUrl(asset.browser_download_url);
			if (!href) { continue; }
			const link = document.createElement('a');
			link.href = href;
			link.textContent = `Download ${asset.name || 'asset'} ↗`;
			link.rel = 'noopener noreferrer';
			article.append(link);
		}
		const href = safeUrl(release.html_url);
		if (href) {
			const link = document.createElement('a'); link.href = href; link.textContent = 'View on GitHub ↗'; link.rel = 'noopener noreferrer'; article.append(link);
		}
		list.append(article);
	}
}
async function loadReleases() {
	try {
		const localResponse = await fetch('releases.json');
		if (!localResponse.ok) { throw new Error('Local release manifest unavailable'); }
		const config = await localResponse.json();
		releases = Array.isArray(config.releases) ? config.releases.filter(release => release && typeof release === 'object' && !release.draft) : [];
		if (config.repository) {
			if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) { throw new Error('Invalid repository'); }
			const remote = [];
			for (let page = 1; page <= 20; page++) {
				const response = await fetch(`https://api.github.com/repos/${config.repository}/releases?per_page=100&page=${page}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
				if (!response.ok) { throw new Error('GitHub unavailable'); }
				const batch = await response.json();
				if (!Array.isArray(batch)) { throw new Error('Invalid release response'); }
				remote.push(...batch.filter(release => release && !release.draft));
				if (batch.length < 100) { break; }
			}
			releases = remote;
		}
		renderReleases();
	} catch {
		renderReleases();
		status.textContent = releases.length ? 'Live releases could not be refreshed. Showing locally maintained releases.' : 'Releases could not be loaded. Please try again later. No download has been selected.';
	}
}
document.querySelector('#release-search').addEventListener('input', renderReleases);
document.querySelector('#release-channel').addEventListener('change', renderReleases);
window.addEventListener('hashchange', updateNavigation);
function updateNavigation() {
	for (const link of document.querySelectorAll('[data-route]')) {
		const active = link.hash === (location.hash || '#home');
		link.classList.toggle('active', active);
		if (active) { link.setAttribute('aria-current', 'location'); } else { link.removeAttribute('aria-current'); }
	}
}
updateNavigation();
loadReleases();
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
