# Rebuilding the Windows Preview

The editor baseline is Microsoft's MIT-licensed Code OSS commit `7e7e374944b20292ae1b9d6f332ec9c9645c1241` (internal editor version 1.146.0). The preview's application release identifier is `0.6.0-preview.2`; the editor's compatibility version is retained for extension compatibility.

The repository contains the Wispr extension, themes, onboarding contribution, installer source and a patch for tracked desktop modifications. It does not duplicate the entire upstream Code OSS tree.

1. Clone the upstream Code OSS source and check out the exact baseline.
2. Apply `patches/desktop.patch` from that source root.
3. Copy `desktop-extension` to `extensions/wispr-flow`, the two theme JSON files to `extensions/theme-defaults/themes`, and `workbench/wisprOnboarding.ts` to `src/vs/workbench/contrib/wispr/browser/wisprOnboarding.ts`.
4. Install the source tree's pinned Node/pnpm versions and Windows native build prerequisites. Install dependencies using the root pnpm lockfile. Do not use the website's Node modules for the desktop source.
5. Run the source's `vscode-win32-x64-min` gulp task. Ensure the installed Windows SDK's x64 tools directory (including signtool.exe) is on PATH. This tool prepares native signatures/version metadata; it does not publisher-sign the final installer.
6. Install the exact official Codex runtime from `codex-runtime/package.json` in an isolated directory. Copy the complete `vendor/x86_64-pc-windows-msvc` tree into the packaged `resources/app/extensions/wispr-flow/runtime`, preserving `bin`, `codex-resources`, `codex-path` and metadata. Copy `licenses/CODEX-LICENSE.txt` and `CODEX-NOTICE.txt` to the runtime root. Do not copy any account/profile files.
7. Ensure the final package contains the current extension source, including `ide-tools.cjs`, and set optional `wisprVersion` metadata in its product JSON to the preview release identifier.
8. Build and copy the Open VSX verifier as described in [signature-verifier/README.md](signature-verifier/README.md). This is required for extension installation in the packaged client; do not substitute proprietary Microsoft binaries or disable signature verification. Then compile `packaging/installer.iss` with Inno Setup 6.4.1 or a compatible version, defining `PackageDir` as the packaged `VSCode-win32-x64` folder and `OutputDir` as your artifacts folder.
9. Validate clean-profile startup, install/uninstall, runtime operation, Flow handoff, approvals, and checksums before publishing. Publisher signing requires your own protected certificate and is not configured here.

The installer requires an existing official Wispr Flow installation; it does not silently install third-party applications or bypass Windows protections. Code signing and physical microphone/hotkey tests remain separate release gates. See the release notes for exactly what this preview claims.
