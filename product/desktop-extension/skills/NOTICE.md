# Third-party skills

The `frontend-design`, `webapp-testing`, `mcp-builder`, and `web-artifacts-builder` directories are based on [Anthropic's official Agent Skills repository](https://github.com/anthropics/skills), pinned to commit `ca45fc496a3436251f191354091d557da31c15b5`, retrieved November 3, 2026. Copyright and license notices are retained in each directory's `LICENSE.txt`. These four skills are distributed under Apache License 2.0.

Local modification: `webapp-testing/scripts/with_server.py` now terminates the owned server process tree on Windows and the process group on POSIX, and inherits output streams instead of leaving unread pipes that could block verbose servers. The change is marked in that file. Other upstream skill files are unmodified.

Wispr ID's skill selection, editor interface, and request adapter are separate implementations. Anthropic does not endorse this integration. Skills are instructions and reference resources, not installed models or automatic permissions to execute scripts. Running an upstream helper may require Python, Bash, browser dependencies, package downloads, or service authentication described by that skill.

The source-available `docx`, `pdf`, `pptx`, and `xlsx` skills are not bundled. Anthropic brand-guideline assets are not included in Wispr branding.
