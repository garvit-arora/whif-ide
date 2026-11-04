/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
'use strict';
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

loadReleases();
