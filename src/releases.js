/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
export function safeUrl(value) {
	try { const url = new URL(value); return url.protocol === 'https:' && ['github.com', 'objects.githubusercontent.com'].includes(url.hostname) && !url.username && !url.password ? url.href : null; }
	catch { return null; }
}

export function getWindowsInstaller(release) {
	const assets = (Array.isArray(release?.assets) ? release.assets : []).filter(asset => {
		const url = asset && safeUrl(asset.browser_download_url);
		return url && typeof asset.name === 'string' && /\.exe$/i.test(asset.name) && /\.exe$/i.test(new URL(url).pathname) && !/arm64|aarch64|ia32|x86(?![_-]?64)/i.test(asset.name);
	});
	return assets.find(asset => /x64|amd64|x86[_-]?64/i.test(asset.name)) || assets[0] || null;
}

export function getLatestStable(releases) {
	return releases.filter(release => !release.draft && !release.prerelease).sort((a, b) => (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0))[0] || null;
}

export function getLatestDownloadRelease(releases) {
	return getLatestStable(releases) || releases.filter(release => !release.draft && release.prerelease).sort((a, b) => (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0))[0] || null;
}

export async function loadReleases(signal) {
	let fallback = [];
	try {
		const local = await fetch(`${import.meta.env.BASE_URL}releases.json`, { signal });
		if (!local.ok) { throw new Error('Manifest unavailable'); }
		const config = await local.json();
		fallback = Array.isArray(config.releases) ? config.releases.filter(release => release && typeof release === 'object' && !release.draft) : [];
		if (!config.repository) { return { releases: fallback, warning: '' }; }
		if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) { throw new Error('Invalid repository'); }
		const releases = [];
		for (let page = 1; page <= 20; page++) {
			const response = await fetch(`https://api.github.com/repos/${config.repository}/releases?per_page=100&page=${page}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
			if (!response.ok) { throw new Error('GitHub unavailable'); }
			const batch = await response.json();
			if (!Array.isArray(batch)) { throw new Error('Invalid response'); }
			releases.push(...batch.filter(release => release && !release.draft));
			if (batch.length < 100) { return { releases, warning: '' }; }
		}
		return { releases, warning: 'Showing the first 2,000 published releases.' };
	} catch (error) {
		if (signal.aborted) { throw error; }
		return { releases: fallback, warning: fallback.length ? 'Live releases could not be refreshed. Showing locally maintained releases.' : 'Releases could not be loaded. Please try again later. No download has been selected.' };
	}
}
