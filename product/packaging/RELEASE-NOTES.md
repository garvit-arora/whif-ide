# Wispr IDE 0.6.0 Preview 1 — Windows x64

An unsigned preview build for early testing, not a production-stable or security-certified release.

## Included

- Code OSS-based desktop editor with Wispr Focus/Midnight themes.
- Custom Home (`Ctrl+Alt+H`), Build (`Ctrl+Alt+W`) and Flow shortcut configuration (`Ctrl+Alt+Shift+W`).
- Borderless animated transcript and automatic submission of verified Windows Flow handoffs.
- Bundled official Codex CLI 0.166.0, with GPT-6.1 Sol / low reasoning selected only if advertised for the user's account.
- Codex IDE tools to inspect structured editor/extension context, open views, search/install extensions, activate installed extensions and invoke declared extension commands.
- Approval prompts remain for extension installation and extension command execution. Untrusted/non-local workspaces cannot execute IDE tools.
- Installer and agent startup require an official Wispr Flow installation. Flow is not bundled; download it from https://wisprflow.ai/download.
- React website routes downloads through `/releases` and reads GitHub release assets automatically.

## Setup

1. Install the official Wispr Flow desktop app and start it.
2. Download the Windows x64 setup EXE and compare its SHA-256 with `SHA256SUMS.txt`.
3. Install Wispr IDE Preview. This build is unsigned; Windows may show a publisher warning. Do not disable antivirus protections.
4. Open and trust a local project. Sign into Codex through **Wispr ID: Sign In to Coding Agent** using your own supported account.
5. Match the IDE's Flow shortcut with the shortcut configured in the official Flow app. Press it while the IDE is foreground, then dictate an instruction.
6. Try “Open the extensions view” or “Install extension publisher.extension”. Review the publisher and approve installation if you trust it.

## Limitations

Physical microphone/hotkey/clipboard handoff requires testing on your target machine. Provider availability, quota and billing are not bundled or unlimited. Login is not supplied with the installer. No personal profiles, credentials or OAuth secrets are included.

IDE context is structured extension/editor state, not arbitrary screenshot vision or unrestricted desktop button clicking. Extension compatibility depends on Open VSX availability and the extension's supported APIs. Some extensions require reload or user interaction. The Claude fallback does not receive the Codex-specific IDE tool bridge.

Google website login requires separate backend credentials; it does not sign into a desktop agent. This release is not code-signed, and no claim of independent security auditing is made.

## Verification Performed

- Official minified Windows x64 package build completed.
- 43 extension tests and the website OAuth tests passed.
- A live GPT-6.1 Sol request invoked the structured IDE context tool successfully.
- The packaged app launched with a clean test profile; Home and its Open Build action worked.
- Setup installed successfully into an isolated folder (exit code 0); the installed copy passed the same UI smoke check.
- Uninstall completed successfully (exit code 0), removing the test application.
- The React downloads route resolves the preview installer asset and labels it as an unsigned preview.
- SHA-256 is published in `SHA256SUMS.txt`.

This is testing on the development Windows machine, not a clean-VM/platform certification. Physical speech capture, arbitrary third-party extension compatibility, publisher signing and external security auditing remain unverified.
