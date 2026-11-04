# Wispr IDE 0.6.0 Preview 2 - Windows x64

Unsigned preview for early testing, not a security-certified or production-stable release.

## Fixed

- Extension gallery search and control manifests no longer crash when the bundled default chat agent is absent.
- Agent extension searches return actual Open VSX publisher IDs.
- Installation is reported as successful only after the extension appears in the IDE registry.
- Tool progress and failures are visible in the agent output.
- Packaged Open VSX installations use a registry-specific Ed25519 signature verifier instead of a missing proprietary runtime. Signature failures remain blocking.
- Explicit screen-reading requests can share a real image of the current IDE window with Codex, after approval.

## Use

1. Install the official Wispr Flow app from https://wisprflow.ai/download.
2. Download the x64 setup EXE and compare its SHA-256 against SHA256SUMS.txt. Keep Windows security protections enabled.
3. Install the preview, open a trusted local project and sign into your own supported Codex account.
4. Configure the matching Flow shortcut with Ctrl+Alt+Shift+W. Ctrl+Alt+W opens Build; Ctrl+Alt+H opens Home.
5. Ask to search for and install an extension. Review the tool approval and the IDE's separate publisher-trust prompt.
6. Ask to read the IDE screen. Approve image sharing only after checking that no sensitive content is visible.

## Limits

No unrestricted desktop clicking or background surveillance. Screenshots may contain visible code or secrets and are sent to your selected provider only with approval. Third-party commands remain allowlisted. Extensions must be available on Open VSX and may require reload, account setup or additional interaction; not every Microsoft Marketplace extension is available there.

Wispr Flow is installed separately and required by the installer. Provider access, usage limits and billing still apply. Model availability is validated against the user's account. Physical microphone/hotkey dictation remains unverified in this environment. No clean-VM certification, code-signing certificate or independent security audit is claimed.

See product/packaging/verification.json in the source for completed build and smoke-test checks. The React website uses /releases (not a standalone HTML page) and selects the latest published preview when no stable release exists.

## Upstream security review

A parent Code OSS dependency scan reports unresolved advisories, including a critical DOMPurify entry. Packaged exposure is not fully triaged. Do not use this unsigned preview as a hardened environment for untrusted repositories or sensitive production work. See product/packaging/SECURITY-CHECKS.md for scope and limitations. Website-only and new verifier dependency scans reported zero advisories.
