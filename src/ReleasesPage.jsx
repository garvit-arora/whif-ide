/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getLatestDownloadRelease, getWindowsInstaller, loadReleases, safeUrl } from './releases.js';

function ReleaseCard({ release }) {
	const date = new Date(release.published_at);
	const href = safeUrl(release.html_url);
	const installer = getWindowsInstaller(release);
	return <article className="release-card"><h3>{release.name || release.tag_name || 'Release'}</h3><small>{release.prerelease ? 'Preview' : 'Stable'} · {release.tag_name} · {Number.isNaN(date.valueOf()) ? 'Date not provided' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</small><div className="installer-action">{installer ? <a className="outline-button installer-get" href={safeUrl(installer.browser_download_url)} download={installer.name} rel="noopener noreferrer">Get {release.tag_name || release.name} for Windows ↓</a> : <span>Windows x64 installer not published for this release.</span>}</div><p>{typeof release.body === 'string' ? release.body : ''}</p><div>{(Array.isArray(release.assets) ? release.assets : []).filter(asset => asset && safeUrl(asset.browser_download_url)).map((asset, index) => <a key={asset.id || index} href={safeUrl(asset.browser_download_url)} rel="noopener noreferrer">Download {asset.name || 'asset'} ↗</a>)}{href && <a href={href} rel="noopener noreferrer">View on GitHub ↗</a>}</div></article>;
}

export default function ReleasesPage() {
	const [data, setData] = useState({ releases: [], warning: '', loading: true });
	const [search, setSearch] = useState('');
	const [channel, setChannel] = useState('all');
	useEffect(() => {
		let controller;
		let active = false;
		async function refresh() {
			if (active || document.hidden) { return; }
			active = true;
			controller = new AbortController();
			try { const result = await loadReleases(controller.signal); if (!controller.signal.aborted) { setData({ ...result, loading: false }); } }
			catch { /* Aborted when leaving the downloads route. */ }
			finally { active = false; }
		}
		refresh();
		const timer = setInterval(refresh, 60000);
		document.addEventListener('visibilitychange', refresh);
		return () => { controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
	}, []);
	const latest = getLatestDownloadRelease(data.releases);
	const latestInstaller = getWindowsInstaller(latest);

	const filtered = data.releases.filter(release => (channel === 'all' || Boolean(release.prerelease) === (channel === 'preview')) && `${release.name} ${release.tag_name} ${release.body}`.toLowerCase().includes(search.toLowerCase()));
	const status = data.loading ? 'Opening the cabinet…' : data.warning || (data.releases.length ? `${filtered.length} release${filtered.length === 1 ? '' : 's'} found.` : 'The cabinet is ready. The first public release is still on its way. Come back here for verified downloads and release notes.');
	return <div className="downloads-page"><header className="vela-nav"><Link className="vela-brand" to="/"><span />Wispr <b>IDE</b></Link><nav aria-label="Main navigation"><Link to="/#features">Product</Link><Link to="/#workflow-title">Workflow</Link><NavLink to="/releases">Releases</NavLink></nav><Link className="outline-button" to="/">Back to home ↗</Link></header><main><div className="download-intro"><span className="story-kicker">Your next workspace starts here.</span><h1>Less friction.<br />Your next version.</h1><p>Download Wispr IDE from a published release below. Install the official Wispr Flow desktop app alongside it for the voice-first workflow.</p><div className="latest-download" aria-label="Latest Windows download">{latestInstaller ? <a id="get-latest" className="outline-button installer-get" href={safeUrl(latestInstaller.browser_download_url)} download={latestInstaller.name} rel="noopener noreferrer">Get WHIF IDE ↓</a> : <button id="get-latest" className="outline-button" disabled>{data.loading ? 'Checking latest release…' : 'Windows download coming soon'}</button>}<p role="status">{latestInstaller ? (latest.tag_name || latest.name) + (latest.prerelease ? ' · Preview — unsigned test build · Windows x64' : ' · Latest stable · Windows x64') : data.warning ? 'Unable to verify the latest Windows download. Please check back shortly.' : 'The download will appear here when a published release includes a Windows x64 .exe.'}</p></div><p className="flow-requirement">Requires the official <a href="https://wisprflow.ai/download" rel="noopener noreferrer">Wispr Flow desktop app</a>.</p></div><section id="releases" className="releases" aria-labelledby="releases-title"><div className="section-top"><span>02 / THE RELEASE CABINET</span><span>ALWAYS A WORK IN PROGRESS. JUST LIKE US.</span></div><div className="release-heading"><h2 id="releases-title">Good things.<br />New versions.</h2><p>Every improvement, in one little place.<br />Pick a release. See what changed. Make something.</p></div><div className="release-tools"><label>Find a release<input id="release-search" type="search" placeholder="Search versions and release notes…" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Channel<select id="release-channel" value={channel} onChange={event => setChannel(event.target.value)}><option value="all">All releases</option><option value="stable">Stable</option><option value="preview">Preview</option></select></label></div><p id="release-status" role="status">{status}</p><div id="release-list">{filtered.map((release, index) => <ReleaseCard key={release.id || index} release={release} />)}</div><div className="release-note">A download appears here only after an actual release is published. No pretend versions. No mystery installers.</div></section></main></div>;
}
