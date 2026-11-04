# Preview 2 Security Checks

This is a targeted engineering review, not an independent security audit or certification.

## Completed

- 46 extension tests, including denied approvals, untrusted workspaces, command allowlists and transcript provenance.
- Open VSX signature tests covering a genuine signed package, changed package/signature data, untrusted key hosts and unavailable trust metadata.
- Packaged and installed-copy tests confirmed actual extension registration, successful signature verification and an approved IDE-window image sent to Codex.
- Website-only production dependency advisory scan: zero reported advisories at scan time.
- New signature runtime dependency advisory scan: zero reported advisories at scan time.
- Installer digest matches the uploaded GitHub asset. No personal profiles or account credentials are included.

## Unresolved Upstream Dependency Review

A broader production-dependency scan of the parent Code OSS workspace reported 1 critical, 17 high, 17 moderate and 7 low advisory instances. That graph is broader than the final installer; packaged component exposure and exploitability have not been fully triaged. These findings are not erased by the clean website-only scan.

The critical entry is [DOMPurify GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), reported for versions >=3.4.4 through 3.4.16, with a patched range >=3.4.17. Additional entries involve SDKs, network/HTTP utilities and renderers in the upstream graph. Updating and validating the affected desktop dependency set is a separate hardening task; this hotfix does not claim to resolve them.

Do not deploy this preview as a hardened environment for untrusted repositories or sensitive production work. Keep workspace trust and action approvals enabled. Signature verification checks registry integrity, not whether an extension's code is safe.

## Other Limits

The installer is unsigned. Physical microphone/hotkey handoff, clean-VM coverage, independent audit, arbitrary third-party extension compatibility and provider-specific data retention are not certified. Screenshots can contain secrets; approval is required before sharing an IDE image with the provider. No unrestricted desktop clicking or background recording is implemented.
