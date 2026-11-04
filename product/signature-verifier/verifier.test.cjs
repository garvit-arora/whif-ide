const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { verify } = require('./index.cjs');
const root = __dirname;

test('real Open VSX fixture validates; tampering, untrusted keys and offline trust fail closed', async () => {
	const originalFetch = global.fetch;
	const metadata = JSON.parse(await fs.readFile(path.join(root, 'prettier-metadata.json'), 'utf8'));
	const key = await fs.readFile(path.join(root, 'registry-key.pem'), 'utf8');
	const packagePath = path.join(root, 'prettier.vsix'); const signature = path.join(root, 'prettier.sigzip');
	try {
		global.fetch = async url => new Response(String(url).includes('/public-key/') ? key : JSON.stringify(metadata));
		assert.equal((await verify(packagePath, signature)).code, 'Success');
		const tampered = await fs.readFile(signature); tampered.fill(0, 0, 4);
		const badSignature = path.join(root, 'tampered.sigzip'); await fs.writeFile(badSignature, tampered);
		assert.notEqual((await verify(packagePath, badSignature)).code, 'Success');
		const bytes = await fs.readFile(packagePath); bytes[Math.floor(bytes.length / 2)] ^= 1;
		const badPackage = path.join(root, 'tampered.vsix'); await fs.writeFile(badPackage, bytes);
		assert.notEqual((await verify(badPackage, signature)).code, 'Success');
		global.fetch = async () => new Response(JSON.stringify({ files: { publicKey: 'https://attacker.invalid/api/-/public-key/123' } }));
		assert.notEqual((await verify(packagePath, signature)).code, 'Success');
		global.fetch = async () => { throw new Error('offline'); };
		assert.notEqual((await verify(packagePath, signature)).code, 'Success');
	} finally { global.fetch = originalFetch; }
});
