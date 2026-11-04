/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
import { useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './HomePage.jsx';
import ReleasesPage from './ReleasesPage.jsx';
import Footer from './Footer.jsx';
import AccountDialog from './AccountDialog.jsx';

export default function App() {
	const location = useLocation();
	const dialog = useRef(null);
	const authFailed = useRef(new URL(window.location.href).searchParams.get('auth') === 'failed');
	const [account, setAccount] = useState({ configured: false, user: null, message: 'Checking website sign-in…' });
	async function refreshAccount(signal) {
		try {
			const response = await fetch('/api/session', { cache: 'no-store', signal });
			if (!response.ok) { throw new Error('Account service unavailable'); }
			const session = await response.json();
			setAccount({ ...session, message: authFailed.current ? 'Google sign-in was cancelled or could not be verified. Please try again.' : session.user ? `Signed in as ${session.user.name} (${session.user.email}). This is your website account, not your agent connection.` : session.configured ? 'Sign in with Google to create your website session.' : 'Google login needs server configuration. No account has been connected.' });
		} catch (error) {
			if (error.name !== 'AbortError') { setAccount({ configured: false, user: null, message: 'The account service is unavailable. Use the Node backend to enable Google login.' }); }
		}
	}
	useEffect(() => {
		const controller = new AbortController(); refreshAccount(controller.signal);
		return () => controller.abort();
	}, []);
	useEffect(() => {
		document.title = location.pathname === '/releases' ? 'Downloads & Releases | Wispr IDE' : location.pathname === '/' ? 'Wispr IDE | Build in your flow' : 'Page not found | Wispr IDE';
		const frame = requestAnimationFrame(() => {
			if (location.hash) { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView(); }
			else { window.scrollTo(0, 0); }
		});
		return () => cancelAnimationFrame(frame);
	}, [location.pathname, location.hash]);
	useEffect(() => {
		const url = new URL(window.location.href);
		if (!url.searchParams.has('auth')) { return; }
		if (!dialog.current.open) { dialog.current.showModal(); }
		if (url.searchParams.get('auth') === 'failed') { setAccount(value => ({ ...value, message: 'Google sign-in was cancelled or could not be verified. Please try again.' })); }
		url.searchParams.delete('auth'); window.history.replaceState(null, '', url);
	}, []);
	return <><Routes><Route path="/" element={<HomePage signedIn={Boolean(account.user)} onSignIn={() => dialog.current.showModal()} />} /><Route path="/releases" element={<ReleasesPage />} /><Route path="*" element={<main className="download-intro"><h1>That page has moved.</h1><p>Find your way back to your flow.</p><Link to="/" className="outline-button">Back to home ↗</Link></main>} /></Routes><Footer /><AccountDialog dialog={dialog} account={account} onLogout={async () => {
		try { const response = await fetch('/auth/logout', { method: 'POST', headers: { 'X-Wispr-Request': 'logout' } }); if (!response.ok) { throw new Error('Failed'); } await refreshAccount(); }
		catch { setAccount(value => ({ ...value, message: 'Could not sign out. Please retry.' })); }
	}} /></>;
}
