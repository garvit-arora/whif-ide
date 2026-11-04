# wispr id.

### Speak freely. Build beautifully.

**Your voice, your agents, your editor.** A focused development environment built on Code OSS, with voice handoff from the official Wispr Flow app and support for installed Codex and Claude Code agents.

[The Experience](#the-experience) · [Run the Website](#run-the-website) · [Releases](#releases) · [Screenshots](#screenshots) · [Release Readiness](#release-readiness)

---

## The Experience

| You bring | Wispr ID provides |
| --- | --- |
| An idea, spoken or typed | A Build panel below your editor |
| Your installed agents | Codex app-server integration and Claude Code fallback |
| Your development workflow | Monaco editing, a native terminal, Open VSX extensions |
| Your taste | Wispr Focus and Wispr Midnight themes |

The official Wispr Flow application is installed separately. Verified automatic voice handoff is Windows-specific. Agent sign-in, availability, usage limits, approvals, and billing belong to the respective providers. This project is a Code OSS fork; it does not imply endorsement by Microsoft, OpenAI, Anthropic, or Wispr.

## Run the Website

No installation, dependency downloads, API keys, or build step required. From this directory:

```powershell
node serve.cjs
```

Open **http://127.0.0.1:4173**. Serve over HTTP rather than opening the HTML directly so the release manifest and session endpoint can load. Stop with Ctrl+C. The editable draft does not record audio or invoke an agent.

Deploy `index.html`, `style.css`, `hero.css`, `vela.css`, `app.js`, and `releases.json` together for the static website. Google login additionally requires the Node server and the environment configuration described in [AUTH.md](AUTH.md); static hosting alone cannot run it. Apply the security headers in `SECURITY.md` at your host. The development server is local-only and is not a production server.

## Releases

The release cabinet lives on the dedicated `releases.html` downloads page. All IDE download and release links on the landing page lead there. It supports version/note search, stable/preview filters, release notes, and asset links. No release has been invented or preloaded. Include `releases.html` and `releases.js` in static deployments alongside the other public files.

### Connect GitHub Later

Set `repository` in `releases.json` to your public `OWNER/REPOSITORY`. The website requests published releases directly from GitHub's public API when loaded, including assets and preview releases. Drafts are excluded. Pagination supports up to 2,000 entries. Anonymous GitHub rate limits apply; for larger audiences, use a scheduled server-side sync to the local manifest or a cached backend. Never embed a GitHub token in frontend files.

### Maintain Releases Manually

Leave `repository` empty and add actual releases to the `releases` array using GitHub's release fields:

```json
{
  "repository": "",
  "releases": [
    {
      "name": "Your actual release title",
      "tag_name": "vYOUR_VERSION",
      "published_at": "2026-11-04T00:00:00Z",
      "prerelease": true,
      "body": "Describe the real changes and known limitations.",
      "html_url": "https://github.com/OWNER/REPOSITORY/releases/tag/vYOUR_VERSION",
      "assets": []
    }
  ]
}
```

Replace every example value before publishing. Add an asset with `name` and `browser_download_url` after uploading the real installer to GitHub Releases. Supported links use HTTPS on `github.com` or `objects.githubusercontent.com`. Local manifest entries are a fallback if live GitHub refresh fails. Notes render as plain text for safety, not executable HTML or Markdown.

## Screenshots

1. Capture the real desktop client with a demo project. Hide tokens, personal paths, email addresses, and private source code.
2. Create an `images` folder next to this README.
3. Add `workspace.png`, `voice-build.png`, and `website.png`. Use reasonably compressed PNG or WebP images.
4. Insert the following Markdown after the images exist:

```markdown
### Your workspace, in focus
![Wispr ID editor showing a demo project](images/workspace.png)

### An idea, out loud
![Wispr ID Build panel with a voice instruction](images/voice-build.png)

### The release cabinet
![Wispr ID website and release history](images/website.png)
```

Use real captures rather than presenting the website's illustrative editor as a desktop screenshot. For a public repository, move or copy this README and its images together to your desired documentation location.

## Release Readiness

**No Windows installer was produced by this website implementation.** The desktop source lives outside this isolated writable directory. The existing desktop documentation identifies remaining physical dictation, provider, OAuth, platform, and signed-installer verification. An Electron development executable is not a distributable installer.

Before a public desktop release, build from the actual desktop source using its pinned toolchain, run its targeted tests and platform smoke tests, review licenses and bundled extensions, build an installer, sign it with your publisher certificate, and verify installation/uninstallation on a clean Windows system. Publish a SHA-256 checksum alongside the tested installer. Keep signing secrets in protected CI, never in this website.

GitHub connection in this website only reads releases; it does not create or publish them. Repository publication automation must be configured with the real repository and narrowly scoped CI credentials. No credentials are requested or stored here.

## Design Notes

The current landing page adapts the newer Vela reference: warm pastel color states, cycling oversized verbs, candy-like typographic icons, a curved cream foundation strip, and a viewport-height hero. Icons are local typographic illustrations rather than the reference's remote WebP assets. The longer product sections remain below the first screen. A single Web Animation clock drives hero word and icon motion, pauses when hidden, and supports reduced motion and manual pause. No GSAP/CodePen implementation has been supplied or added.

The draft textarea accepts text insertion from an installed dictation app. It does not record audio, auto-submit to an agent, or claim a verified Flow connection. See [Google login and integration boundaries](AUTH.md).

## Security

See [the security review](SECURITY.md) for the reviewed scope, protections, and remaining release gates.
