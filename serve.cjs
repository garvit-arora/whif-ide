/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleAuth } = require('./auth.cjs');
const publicRoot = path.join(__dirname, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (request, response) => {
	response.setHeader('X-Content-Type-Options', 'nosniff');
	response.setHeader('Referrer-Policy', 'no-referrer');
	response.setHeader('X-Frame-Options', 'DENY');
	response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
	let pathname;
	try { pathname = new URL(request.url, 'http://localhost').pathname; } catch { response.writeHead(400); response.end(); return; }
	try { if (await handleAuth(request, response, pathname)) { return; } } catch { response.writeHead(500); response.end('Unable to complete account request'); return; }
	if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
	if (pathname === '/releases.html') { response.writeHead(308, { Location: '/releases' }); response.end(); return; }
	// Only built browser assets are public; backend/source/configuration files stay private.
	const filename = pathname === '/releases.json' ? 'releases.json' : /^\/assets\/[A-Za-z0-9_.-]+$/.test(pathname) ? pathname.slice(1) : pathname === '/index.html' || /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(pathname) ? 'index.html' : null;
	if (!filename) { response.writeHead(404); response.end('Not found'); return; }
	fs.readFile(path.join(publicRoot, filename), (error, data) => {
		if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('Asset unavailable. Build the React app before starting the server.'); return; }
		response.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'Cache-Control': 'no-cache' });
		response.end(request.method === 'HEAD' ? undefined : data);
	});
});
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) { throw new Error('PORT must be an integer between 1 and 65535.'); }
server.on('error', error => { console.error(`Website could not start: ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Wispr IDE website listening on ${host}:${port}`));
