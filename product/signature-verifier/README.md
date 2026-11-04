# Open VSX Signature Verifier

Small MIT-licensed runtime adapter implementing the Open VSX Ed25519 whole-VSIX signature format. It does not include Microsoft's proprietary vsce-sign binaries and does not turn off extension signature checks.

The ZIP reader is pinned in package-lock.json. Registry metadata and keys are fetched only from HTTPS open-vsx.org; key URLs must use the registry's public-key API path. Redirects, unknown key algorithms, excessive response sizes, malformed archives, unavailable keys and invalid signatures fail closed. The complete VSIX bytes are checked against `.signature.sig`. A valid registry signature means the registry signed the package, not that its code or publisher is safe. Existing publisher approval and workspace trust still apply.

Whole-package verification covers all bytes, so this adapter does not separately interpret the per-entry signature manifest. Packages above 256 MiB are rejected by this preview implementation. Offline installation cannot validate an uncached registry key. Only the configured Open VSX service is supported; this is not a Microsoft Marketplace verifier.

## Build and Test

Run inside this directory:

```powershell
npm ci --ignore-scripts
node prepare-fixture.cjs
node --test verifier.test.cjs
```

The fixture script downloads public Prettier 12.4.0 inputs and pins their SHA-256 values; fixture binaries are not committed. Tests cover genuine signatures, changed package/signature bytes, attacker-hosted key URLs and unavailable trust metadata.

Package `index.cjs`, a manifest named `@whif/openvsx-sign` with `main: index.cjs`, and the installed production node_modules inside the editor's `resources/app/node_modules/@whif/openvsx-sign`. The desktop patch changes the signature service import to this adapter. Preserve dependency license notices.

Format reference: https://github.com/filiptronicek/node-ovsx-sign (EPL-2.0 reference implementation, not copied or bundled).

This implementation has targeted tests, not an independent cryptographic/security audit.
