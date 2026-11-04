/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getLatestDownloadRelease, getWindowsInstaller, loadReleases, safeUrl } from './releases.js';

function ReleaseCard({ release }) {
	const date = new Date(release.published_at);
	const href = safeUrl(release.html_url);
	const installer = getWindowsInstaller(release);
	const checksum = (Array.isArray(release.assets) ? release.assets : []).find(asset => asset && /sha256|checksum/i.test(asset.name || '') && safeUrl(asset.browser_download_url));
	return <article className="release-card release-summary">
		<div className="release-summary-heading"><div><span className="release-channel">{release.prerelease ? 'Preview' : 'Stable'}</span><h3>{release.name || release.tag_name || 'Release'}</h3></div><small>{Number.isNaN(date.valueOf()) ? 'Date not provided' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</small></div>
		<p>{release.prerelease ? 'An early build for trying the latest features. This preview is unsigned and may have rough edges.' : 'A published release ready to download. See the changelog for version-specific changes.'}</p>
		{installer && <div className="release-file"><span>Windows x64</span>{Number.isFinite(installer.size) && <span>{Math.round(installer.size / 1024 / 1024)} MiB</span>}<span>{release.tag_name}</span></div>}
		<div className="release-download-actions">{installer ? <a className="outline-button installer-get" href={safeUrl(installer.browser_download_url)} download={installer.name} rel="noopener noreferrer">Get WHIF IDE ↓</a> : <span>Windows installer not available for this version.</span>}{checksum && <a href={safeUrl(checksum.browser_download_url)} rel="noopener noreferrer">Verify checksum ↗</a>}{href && <a href={href} rel="noopener noreferrer">Full release notes on GitHub ↗</a>}</div>
	</article>;
}

function DownloadGuide() {
	return <section className="download-guide" aria-labelledby="setup-title"><div className="section-top"><span>GET STARTED</span><span>THREE STEPS TO YOUR FLOW.</span></div><h2 id="setup-title">From download<br />to your first idea.</h2><ol className="download-steps"><li><span>01</span><h3>Install Wispr Flow.</h3><p>The official Flow desktop app is required. Install it first and sign in, then keep it running when you dictate.</p><a href="https://wisprflow.ai/download" rel="noopener noreferrer">Set up Wispr Flow ↗</a></li><li><span>02</span><h3>Make yourself at home.</h3><p>Install WHIF IDE, open a project folder, and connect your own Codex account. Your provider's access and usage limits apply.</p><span className="step-detail">Windows x64 · Preview build</span></li><li><span>03</span><h3>Say what comes next.</h3><p>Match your Flow shortcut in the IDE. Press it and dictate. Verified captures go to your agent; follow up to change direction.</p><span className="step-detail">Ctrl + Alt + W opens Build</span></li></ol><aside className="preview-note"><strong>A small note before you install.</strong><p>This Windows preview is unsigned. Installation and launch were tested on the development machine; physical voice capture still needs testing on your setup. Review extension and command approvals before allowing changes.</p></aside></section>;
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
	return <div className="downloads-page"><header className="vela-nav"><Link className="vela-brand" to="/"><span />Wispr <b>IDE</b></Link><nav aria-label="Main navigation"><Link to="/#features">Product</Link><Link to="/#workflow-title">Workflow</Link><NavLink to="/releases">Releases</NavLink></nav><Link className="outline-button" to="/">Back to home ↗</Link></header><main><div className="download-intro"><span className="story-kicker">Your next workspace starts here.</span><h1>Less friction.<br />Your next version.</h1><p>Download Wispr IDE from a published release below. Install the official Wispr Flow desktop app alongside it for the voice-first workflow.</p><div className="latest-download" aria-label="Latest Windows download">{latestInstaller ? <a id="get-latest" className="outline-button installer-get" href={safeUrl(latestInstaller.browser_download_url)} download={latestInstaller.name} rel="noopener noreferrer">Get WHIF IDE ↓</a> : <button id="get-latest" className="outline-button" disabled>{data.loading ? 'Checking latest release…' : 'Windows download coming soon'}</button>}<p role="status">{latestInstaller ? (latest.tag_name || latest.name) + (latest.prerelease ? ' · Preview — unsigned test build · Windows x64' : ' · Latest stable · Windows x64') : data.warning ? 'Unable to verify the latest Windows download. Please check back shortly.' : 'The download will appear here when a published release includes a Windows x64 .exe.'}</p></div><p className="flow-requirement">Requires the official <a href="https://wisprflow.ai/download" rel="noopener noreferrer">Wispr Flow desktop app</a>.</p></div><DownloadGuide /><section id="releases" className="releases" aria-labelledby="releases-title"><div className="section-top"><span>02 / THE RELEASE CABINET</span><span>ALWAYS A WORK IN PROGRESS. JUST LIKE US.</span></div><div className="release-heading"><h2 id="releases-title">Good things.<br />New versions.</h2><p>Every improvement, in one little place.<br />Pick a release. See what changed. Make something.</p></div><div className="release-tools"><label>Find a release<input id="release-search" type="search" placeholder="Search versions and release notes…" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Channel<select id="release-channel" value={channel} onChange={event => setChannel(event.target.value)}><option value="all">All releases</option><option value="stable">Stable</option><option value="preview">Preview</option></select></label></div><p id="release-status" role="status">{status}</p><div id="release-list">{filtered.map((release, index) => <ReleaseCard key={release.id || index} release={release} />)}</div><div className="release-note">Downloads are hosted on GitHub. Checksums and complete release notes are available alongside each version.</div></section></main></div>;
}
