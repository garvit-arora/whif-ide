# Wispr IDE

Your voice, your agents, your editor.

This repository currently contains the Wispr IDE landing page, release cabinet, and configurable Google website login. The desktop editor source and Windows installer are not included.

## Start Locally

```powershell
cd frontend
node serve.cjs
```

Open **http://127.0.0.1:4173**.

## Documentation

- [Website, product details, releases, and screenshot instructions](frontend/README.md)
- [Google login configuration and desktop integration boundaries](frontend/AUTH.md)
- [Security review and deployment requirements](frontend/SECURITY.md)

Google login requires server-side OAuth credentials. Agent sign-in and execution remain in the desktop client. Wispr Flow is installed separately for the voice-first workflow.
