/* Copyright (c) Garvit Arora. Licensed under the MIT License. */
'use strict';
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const yauzl = require('yauzl');

function entryBuffer(file, name, limit) {
	return new Promise((resolve, reject) => {
		yauzl.open(file, { lazyEntries: true }, (error, zip) => {
			if (error) { reject(error); return; }
			let found = false;
			zip.on('error', reject);
			zip.on('end', () => { if (!found) { reject(new Error('Required archive entry missing')); } });
			zip.on('entry', entry => {
				if (entry.fileName !== name) { zip.readEntry(); return; }
				found = true;
				if (entry.uncompressedSize > limit) { zip.close(); reject(new Error('Archive entry exceeds limit')); return; }
				zip.openReadStream(entry, (streamError, stream) => {
					if (streamError) { zip.close(); reject(streamError); return; }
					const chunks = []; let size = 0;
					stream.on('error', reject);
					stream.on('data', chunk => {
						size += chunk.length;
						if (size > limit) { stream.destroy(new Error('Archive entry exceeds limit')); zip.close(); }
						else { chunks.push(chunk); }
					});
					stream.on('end', () => { zip.close(); resolve(Buffer.concat(chunks)); });
				});
			});
			zip.readEntry();
		});
	});
}

async function registryText(url, limit) {
	const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
	if (!response.ok) { throw new Error('Registry trust metadata unavailable'); }
	const reader = response.body.getReader(); const chunks = []; let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read(); if (done) { break; }
			size += value.length; if (size > limit) { throw new Error('Registry response exceeds limit'); }
			chunks.push(Buffer.from(value));
		}
	} finally { await reader.cancel(); }
	return Buffer.concat(chunks).toString('utf8');
}

async function verify(vsix, archive) {
	try {
		if ((await fs.stat(vsix)).size > 256 * 1024 * 1024) { throw new Error('Package exceeds verification size limit'); }
		const manifest = JSON.parse((await entryBuffer(vsix, 'extension/package.json', 1024 * 1024)).toString('utf8'));
		if (![manifest.publisher, manifest.name, manifest.version].every(value => typeof value === 'string' && /^[a-z0-9._+-]+$/i.test(value))) { throw new Error('Invalid extension identity'); }
		const metadata = JSON.parse(await registryText(`https://open-vsx.org/api/${encodeURIComponent(manifest.publisher)}/${encodeURIComponent(manifest.name)}/${encodeURIComponent(manifest.version)}`, 1024 * 1024));
		const keyUrl = new URL(metadata.files?.publicKey);
		if (keyUrl.origin !== 'https://open-vsx.org' || keyUrl.username || keyUrl.password || !/^\/api\/-\/public-key\/[a-z0-9-]+$/i.test(keyUrl.pathname) || keyUrl.search || keyUrl.hash) { throw new Error('Untrusted registry key URL'); }
		const key = crypto.createPublicKey(await registryText(keyUrl, 16384));
		if (key.asymmetricKeyType !== 'ed25519') { throw new Error('Unsupported registry signing key'); }
		const signature = await entryBuffer(archive, '.signature.sig', 1024);
		const valid = crypto.verify(null, await fs.readFile(vsix), key, signature);
		return { code: valid ? 'Success' : 'SignatureIsInvalid', didExecute: true };
	} catch (error) {
		return { code: 'SignatureIsInvalid', didExecute: false, output: error.message };
	}
}

module.exports = { verify };
