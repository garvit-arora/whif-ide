# Wispr IDE Desktop Product

## Status and Scope

This directory contains the Wispr desktop extension source, themes, onboarding contribution, installer source, licensing material, and tracked desktop source patch. It is not a full duplicate of the upstream Code OSS source tree. See [rebuild instructions](REBUILD.md) and [preview release notes](packaging/RELEASE-NOTES.md). Compiled installers are GitHub Release assets rather than files committed to Git.

The desktop client is an Electron/TypeScript application derived from Microsoft's MIT-licensed Code OSS. Its internal product identity currently uses **Wispr ID**; the website uses **Wispr IDE**. Command names below retain the real implemented identity so they can be found in the Command Palette.

Downloading the desktop client and installing the official Wispr Flow desktop app are required for the advertised voice-first workflow. Manual editing and typed instructions remain available. Codex and Claude Code are separate installed tools with their own sign-in, access requirements, limits, and billing.

## Source Layout

Paths in this guide are relative to the desktop source root, not this documentation directory.

| Component | Source | Responsibility |
| --- | --- | --- |
| Product identity | `product.json` | Application names, URI scheme, data directories, platform identifiers and extension distribution configuration |
| Desktop package | `package.json`, `pnpm-lock.yaml`, `.nvmrc` | Scripts, exact package-manager/dependency inputs and Node toolchain |
| Base utilities | `src/vs/base` | Shared browser/native utilities, lifecycle and process abstractions |
| Platform services | `src/vs/platform` | Configuration, files, extensions, commands, terminal and infrastructure |
| Editor | `src/vs/editor` | Monaco editing, selection, completion and language tooling |
| Workbench | `src/vs/workbench` | Explorer, search, source control, debugging, tasks, terminal, settings and contribution registration |
| Electron application | `src/vs/code` | Desktop main process and window lifecycle |
| Server | `src/vs/server` | Upstream remote/server functionality; distinct from the website Node server |
| Agent sessions | `src/vs/sessions` | Upstream agent-session workbench infrastructure |
| Wispr contributions | `src/vs/workbench/contrib/wispr` | Product-specific workbench integration |
| Built-in extensions | `extensions` | Language support, Git, authentication, debug tools, themes and Wispr extension |
| Build tooling | `build`, `scripts` | Compilation, downloads, platform packaging and development tools |
| Tests | `test`, component test directories | Unit, browser, integration and smoke infrastructure |
| Platform resources | `resources` | Icons, manifests, installer resources and launch assets |

## Voice and Agent Extension

The integration lives in `extensions/wispr-flow`. It does not implement a competing transcription service.

| File or directory | Responsibility |
| --- | --- |
| `package.json` | Extension activation, commands, settings, keybindings and MCP contribution metadata |
| `extension.cjs` | Activates the extension; coordinates workspace trust, agent sessions, prompt UI, status item and command handlers |
| `prompt.cjs` | Hosts the voice/text Build panel and coordinates messages between its webview and extension |
| `media` | Browser-side prompt presentation and interaction assets |
| `terminal.cjs` | Optional owned agent terminal, input routing and terminal commands |
| `watcher.cjs` | Coordinates observation of official Flow shortcut/transcript handoffs |
| `official-flow.cjs` | Official Flow installation discovery, desktop launching and account-context integration metadata |
| `native` | Windows-specific helper support for shortcut observation and verified transcript handoff |
| `agents/discovery.cjs` | Finds installed Codex/Claude executables and checks their reported account status |
| `agents/codex.cjs` | Owns a Codex app-server process and protocol session; handles account/model checks, task messages and steering |
| `agents/claude.cjs` | Connects to the installed Claude Code provider and handles its task lifecycle |
| `ide-tools.cjs` | Codex dynamic-tool definitions and trusted-workspace bridge for structured IDE context, extension install/activation and declared commands with approval |
| `runtime` (release package only) | Complete official Codex runtime including its code-mode host, sandbox helpers, search resources and notices; no user login is bundled |
| `skills.cjs` | Catalog and copy workflow for reviewed agent skill kits |
| `skills` | Bundled skill content, resources and licensing notices |
| `test` | Targeted tests for the extension and its protocols |

## First-Run Workflow

1. Build or install the desktop client using the project's documented toolchain.
2. Install and start the official Wispr Flow app. Set its preferred dictation shortcut there.
3. Install Codex or Claude Code and complete the provider's official sign-in.
4. Open a trusted local project in Wispr IDE. Agent commands need a local workspace, not an untrusted or non-file workspace.
5. Run **Wispr ID: Configure Official Flow Hotkey** and match the shortcut already configured in Flow. The IDE does not change Flow's shortcut for you.
6. Open Build using **Ctrl+Alt+W**. Dictate using Flow or enter a typed instruction.
7. Review approvals and output, inspect changes, and run the project's own tests before accepting the result.

## Commands and Controls

| Command | Purpose |
| --- | --- |
| `Wispr ID: Open Voice and Text Prompt` | Opens the Build panel |
| `Wispr ID: Toggle Flow Auto-send` | Pauses or enables verified Flow routing |
| `Wispr ID: Interrupt Coding Agent` | Requests interruption of the owned active session |
| `Wispr ID: Sign In to Coding Agent` | Opens the discovered provider's official sign-in command in a terminal |
| `Wispr ID: New Coding Agent Session` | Resets the owned session and checks providers again |
| `Wispr ID: Configure Official Flow Hotkey` | Matches the observed shortcut to the user's Flow configuration |
| `Wispr ID: Check Installed Agent Login` | Reports detected provider authentication |
| `Wispr ID: Open Official Wispr Flow` | Launches an identified installed Flow desktop app |
| `Wispr ID: Connect Official Wispr Account Context` | Registers the official account-context MCP endpoint; OAuth is separate from dictation |
| `Wispr ID: Add Agent Skill to Project` | Copies a selected reviewed skill kit without replacing existing content |
| `Wispr ID: Send or Steer Agent Prompt` | Submits a new instruction or correction through the integration |
| `Wispr ID: Open Agent Terminal` | Opens terminal controls for the owned session |

Typed submission uses **Ctrl+Enter**. Enter and Shift+Enter retain multiline editing. **Ctrl+Alt+Escape** requests interruption. The agent terminal also supports `/help`, `/login`, `/new`, `/retry` and `/stop`. An interruption cannot undo commands or edits that already completed.

## Agent Authentication and Execution

Codex is preferred when an authenticated installation is available. It runs through an owned official stdio app-server session. New instructions during a task steer the active thread/turn rather than starting an independent task. The integration checks account and available-model responses instead of assuming access from a browser login.

Authenticated Claude Code can be used as a fallback. Follow-up corrections interrupt the current response and wait for acknowledgment before delivery. Existing unrelated agent terminals and external conversations are not adopted by the IDE.

The website's Google account is a separate identity. It does not authorize either desktop agent, grant a subscription, carry provider credentials, or remove usage limits.

## Wispr Flow Handoff

On Windows, automatic routing observes the configured shortcut while the IDE is foreground and the official Flow installation is running. The handoff checks transcript clipboard ownership against Flow's installation before accepting automatic submission. Unverified/manual dictation stays a draft. Escape cancels capture. Ordinary keystrokes and arbitrary clipboard contents are not intended as input to the agent.

The shortcut initially defaults to `Ctrl+Win`; a user's launch profile may override it, including a Copilot hardware-key alias. Configure Flow and the IDE to match instead of assuming a machine-specific shortcut.

Automatic shortcut observation is not implemented on other platforms. Manual dictation and submission remain available. Real microphone, shortcut, clipboard ownership, focus and cancellation behavior require testing on the target Windows machine.

## Settings

The development profile now uses a project-local official Codex CLI 0.166.0 from `product/codex-runtime`, with `wispr.voice.model` set to `gpt-6.1-sol` and `wispr.voice.reasoningEffort` set to `low` (light reasoning). The prior CLI 0.142.5 advertised an obsolete GPT-5.5 default. Model and effort selection are validated against the installed CLI's live catalog; requested unavailable models fail clearly rather than silently substituting another model. Both thread and turn requests explicitly select the model, and turn requests explicitly set effort. A minimal real request returned OK with the new settings. Keep the runtime directory available or update `wispr.voice.codexPath` after moving it.

Release installations discover the bundled `extensions/wispr-flow/runtime/bin/codex.exe` before searching PATH, unless an explicit executable override is configured. All runtime support files are preserved. Users sign in with their own account; the build contains no development profile, credentials, machine settings or account tokens. The installer and agent startup verify that official Wispr Flow is installed.

For extension work, dictate an instruction such as “Open the extensions view” or “Install extension esbenp.prettier-vscode”. Codex can call `wispr_ide_context` to inspect editor/workspace/extension state and `wispr_ide_action` to navigate common views, search extensions, install a publisher.extension ID, activate an installed extension or run one of its declared commands. Third-party installs and extension command execution require approval, and workspace trust is rechecked before execution. These tools do not permit arbitrary command IDs, remote VSIX URLs, untrusted-workspace execution, screenshot surveillance or automatic clicking of arbitrary desktop controls.

Custom desktop Home is available with `Ctrl+Alt+H`; Build uses `Ctrl+Alt+W`; Flow shortcut configuration uses `Ctrl+Alt+Shift+W`. Home displays the configured official Flow shortcut and local workspace/trust requirements, with allowlisted actions for project opening, account checks, agent sign-in and Build. It opens automatically when no editor tabs are present. Voice dictation still uses the shortcut configured in the separately installed official Flow app.

| Setting | Purpose |
| --- | --- |
| `wispr.voice.hotkey` | Shortcut to observe; must match the official Flow app |
| `wispr.voice.autoSend` | Enables/disables automatic routing of verified Flow captures |
| `wispr.voice.preferredAgent` | Chooses Codex or Claude preference |
| `wispr.voice.model` | Exact Codex model; defaults to GPT-6.1 Sol and must be advertised by the installed account |
| `wispr.voice.reasoningEffort` | Advertised reasoning effort; defaults to low |
| `wispr.voice.codexPath` | Optional installed Codex executable override |
| `wispr.voice.claudePath` | Optional installed Claude executable override |

Wispr Focus is the default charcoal theme; Wispr Midnight is another product theme. Open VSX provides extension discovery, subject to extension compatibility and availability. Bundled Copilot is excluded from the Wispr runtime; this does not remove all upstream compatibility code.

## Build and Validate

Run commands at the actual desktop source root. Use its pinned Node and pnpm versions, not the website's package scripts. Native Windows dependencies include Visual Studio C++ tools, the Windows SDK, Python and relevant Spectre libraries.

```powershell
pnpm install --frozen-lockfile
pnpm run build-fast --client-only
pnpm run gulp transpile-extensions compile-extension-media
pnpm run typecheck-client
node --test extensions/wispr-flow/test/*.test.cjs
node scripts/wispr-smoke.cjs
python scripts/wispr-skill-smoke.py
```

These commands are taken from the existing desktop development guide. They are not a claim that all checks passed during the website work. For a full client-and-extension build, use the desktop repository's appropriate full compilation command; client-only output is insufficient when required extensions have not been built.

The existing Windows development launcher is `Start-Wispr-ID.cmd` in the desktop checkout's parent directory. It uses prepared output and a persistent development profile. For isolated automation, the launch skill creates a separate profile and debug ports. Neither launcher creates a distributable installer.

## Release Gates

Before publishing desktop source, review licensing and third-party notices, remove credentials and machine profiles from the intended tracked files, and decide the product repository layout explicitly. Do not copy this website's `.publish-whif` checkout or private workspace files into a desktop release.

Before publishing an EXE, verify real agent login, generation, steering, interruption, Flow hotkey capture, OAuth context reads and target-platform behavior. Build the installer through the desktop packaging workflow, sign using a protected publisher certificate, publish a SHA-256 checksum, and verify clean install/uninstall. No signed Windows installer is provided by this documentation change.

## Screenshots

Create an `images` directory next to the future product README. Capture a non-sensitive demo workspace, the Build panel, a provider approval and the themes. Hide personal file paths, credentials, account emails and private code. Then embed real files:

```markdown
![Editor with a demo project](images/editor.png)
![Voice instruction in the Build panel](images/build-panel.png)
```

Use desktop captures for desktop functionality, not website mockups. Commit images only after checking their contents and size.

## Known Limitations

The browser draft is not a remote execution bridge. Google website login is not provider login. No unlimited account access, arbitrary-agent support or signed release is implied. Physical voice routing and real provider access remain dependent on the installed environment and need live validation.
