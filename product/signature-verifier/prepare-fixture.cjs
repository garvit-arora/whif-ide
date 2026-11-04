/* Downloads public, immutable test inputs; never used by the production verifier. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
(async () => {
	const response = await fetch('https://open-vsx.org/api/esbenp/prettier-vscode/12.4.0');
	if (!response.ok) { throw new Error('Fixture metadata unavailable'); }
	const metadata = await response.json();
	const inputs = [
		['prettier.vsix', metadata.files.download, 'fb730ea4306d09cdc0a3aaa9e9baae28058cc97a4fbfce8b056b377a0639a9fe'],
		['prettier.sigzip', metadata.files.signature, '750102d63bd49237b24a00c41e697b40676c6b2031eb6a17954f8547be151388'],
		['registry-key.pem', metadata.files.publicKey, 'ef5759c51be559f00443ab7d568d26304430bdd422592bfa63e6ac584bfe983b']
	];
	for (const [name, url, hash] of inputs) {
		const asset = await fetch(url); if (!asset.ok) { throw new Error('Fixture download failed'); }
		const bytes = Buffer.from(await asset.arrayBuffer());
		if (createHash('sha256').update(bytes).digest('hex') !== hash) { throw new Error('Fixture changed: ' + name); }
		await fs.writeFile(path.join(__dirname, name), bytes);
	}
	await fs.writeFile(path.join(__dirname, 'prettier-metadata.json'), JSON.stringify(metadata));
})().catch(error => { console.error(error); process.exitCode = 1; });
