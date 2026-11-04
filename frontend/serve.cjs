/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleAuth } = require('./auth.cjs');
const files = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/style.css', 'style.css'], ['/hero.css', 'hero.css'], ['/vela.css', 'vela.css'], ['/app.js', 'app.js'], ['/releases.json', 'releases.json']]);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
files.set('/releases.html', 'releases.html');
files.set('/releases.js', 'releases.js');
const server = http.createServer(async (request, response) => {
	response.setHeader('X-Content-Type-Options', 'nosniff');
	response.setHeader('Referrer-Policy', 'no-referrer');
	response.setHeader('X-Frame-Options', 'DENY');
	response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	let pathname;
	try { pathname = new URL(request.url, 'http://localhost').pathname; } catch { response.writeHead(400); response.end(); return; }
	try { if (await handleAuth(request, response, pathname)) { return; } } catch { response.writeHead(500); response.end('Unable to complete account request'); return; }
	if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
	const filename = files.get(pathname);
	if (!filename) { response.writeHead(404); response.end('Not found'); return; }
	fs.readFile(path.join(__dirname, filename), (error, data) => {
		if (error) { response.writeHead(500); response.end('Unable to read asset'); return; }
		response.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'Cache-Control': 'no-cache' });
		response.end(request.method === 'HEAD' ? undefined : data);
	});
});
server.listen(4173, '127.0.0.1', () => console.log('Wispr ID website: http://127.0.0.1:4173'));
