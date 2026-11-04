# IDE Reference Review

These are design references, not bundled dependencies or claims of implemented features. Documentation-only sparse clones were reviewed locally; third-party source trees are not shipped with WHIF IDE.

## Sources

- [Zed agent panel](https://github.com/zed-industries/zed/blob/c7bea343838f42b4c14151393e41f0bbe033c95e/docs/src/ai/agent-panel.md): separate agent profiles and tool permission controls.
- [Zed parallel agents](https://github.com/zed-industries/zed/blob/c7bea343838f42b4c14151393e41f0bbe033c95e/docs/src/ai/parallel-agents.md): isolated worktrees, thread history and reviewing changes before merging.
- [Continue agent architecture](https://github.com/continuedev/continue/blob/5522c6f44ca0ac3528b37244818fbfa39b5af470/docs/ide-extensions/agent/how-it-works.mdx): separate chat, read-only planning and action modes, with permission checks before tool execution.
- [VSCodium packaging patches](https://github.com/VSCodium/vscodium/tree/ca7f7b44b5e5c3faa663f6cdc043998f71936653/patches): reviewed registry/runtime differences. Its signature-disabling patch is deliberately not adopted; WHIF verifies Open VSX whole-package signatures instead.

## Current Hotfix

- Search the extension registry for actual extension IDs rather than guessing a name.
- Verify that installation registered before reporting success.
- Keep third-party publisher confirmation and tool approval intact.
- Share an image of the current IDE window only after explicit approval. No continuous desktop recording or arbitrary mouse automation.
- Show tool progress and failures rather than claiming an action happened.

## Prioritized Follow-Up Options

| Priority | Candidate | Acceptance criteria |
| --- | --- | --- |
| 1 | Read-only Plan mode | Enforce at tool dispatch and provider execution boundaries; no writes, install commands or shell execution. A prompt instruction alone is insufficient. |
| 2 | Action history | Show requested action, approval decision and verified result; redact screenshots and secrets from persistent logs by default. |
| 3 | Review and checkpoints | Preview changes and preserve existing uncommitted work; restoring a checkpoint must never discard unrelated user edits. |
| 4 | Extension workflows | Resolve the publisher, surface install/reload requirements, and invoke only the extension's declared commands. |
| 5 | Isolated parallel tasks | Separate worktree per task, explicit merge review, bounded concurrency and provider quota handling. |

These follow-up options require implementation and tests before being advertised on the website. They are deliberately not mixed into the installation/screenshot hotfix.
