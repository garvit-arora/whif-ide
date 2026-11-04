# Google Login Setup

The Node server implements a Google authorization-code flow with PKCE, browser-bound single-use state, nonce validation, RSA-signed Google ID-token verification, and an eight-hour HTTP-only cookie session. Secrets and Google tokens are never returned to browser JavaScript. No account is claimed as connected without a verified callback.

## Activate Locally

1. In Google Cloud Console, configure the Google Auth consent screen and create an OAuth client of type **Web application**. Add test users while your app is in testing.
2. Register this exact authorized redirect URI: `http://127.0.0.1:4173/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the server process environment through your local secret manager or deployment configuration. Do not put the secret in frontend JavaScript, source control, chat, or a public file.
4. Install dependencies with `corepack pnpm install --frozen-lockfile`, build with `corepack pnpm build`, then start `corepack pnpm start` from this folder. Open `http://127.0.0.1:4173` and choose **Sign in**. The server serves the React build from `dist`.

`PUBLIC_ORIGIN` defaults to `http://127.0.0.1:4173`. When using `localhost`, configure both the environment and Google's redirect URI consistently. Unknown Host headers are rejected on authentication endpoints.

## Deployment Requirements

Set `PUBLIC_ORIGIN` to the real HTTPS origin and register its `/auth/google/callback` URL with Google. Secure cookies are automatically used for HTTPS. Reverse-proxy this local-only Node server at that origin or adapt the endpoints to your hosting framework. Never expose the development preview server directly to the internet.

The session store is deliberately in-memory: restarting logs users out, and multiple instances do not share sessions. For a public deployment, replace it with an expiring shared store, add edge rate limiting, use an established maintained authentication library/service, configure security headers, complete consent-screen requirements, and test a real login/logout flow. The current pending-login and session stores have capacity limits and opportunistic expiry cleanup; these are not a substitute for production rate limiting. No Google account callback has been tested without the owner's OAuth credentials.

## What This Login Does

It identifies a website visitor using their verified Google account. It does not sign them into Codex, transfer a ChatGPT subscription, create a Cline session, or grant the website access to their desktop or files. Agent authentication remains in the installed desktop client via **Wispr ID: Sign In to Coding Agent**, followed by **Wispr ID: Check Installed Agent Login**.

The draft textarea accepts ordinary text insertion from the installed Wispr Flow application. It does not record audio, call a Flow API, verify Flow installation, or automatically execute instructions. Copying a draft into the real desktop Build panel is the available handoff; a secure desktop bridge is not implemented here.

References: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Codex app-server](https://learn.chatgpt.com/docs/app-server).
