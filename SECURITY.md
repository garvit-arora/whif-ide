# Security Review

Scope: this website and its local Node server. This is a source review, not an independent penetration test, desktop security audit, or production readiness certification. Google OAuth has since been added; its configuration, session limits, and production requirements are documented in [AUTH.md](AUTH.md).

## Implemented Protections

- React and React Router DOM are bundled runtime dependencies; Vite is build tooling. Dependency versions are recorded in `pnpm-lock.yaml`. No analytics, microphone access, or embedded secrets. Google identity sessions and short-lived OAuth attempts are held in server memory only; the browser receives an HTTP-only session cookie.
- Release content is rendered as escaped React text; remote release notes are never inserted as HTML.
- Download links require HTTPS and an explicit GitHub host allowlist; embedded URL credentials are rejected.
- Repository input uses a restricted owner/repository format. GitHub requests have a ten-second timeout and bounded pagination.
- Content Security Policy blocks inline script, plugins, external image loads, and unapproved network destinations.
- The Node server defaults to loopback, serves only the built SPA shell, release manifest and hashed assets, rejects unsupported methods, and does not expose backend/source documentation. HOST/PORT can be configured for a protected deployment environment. Client routes use SPA history fallback.
- Reduced motion disables hero animation by default. Animation pauses when hidden and its clock/frame/listeners are disposed when the React hero unmounts.

## Production Hosting

Configure HTTPS and these response headers on your hosting platform:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`frame-ancestors` requires an HTTP header; the HTML meta policy cannot enforce it. Configure HSTS after confirming HTTPS and subdomain requirements. Use a CDN-cached release manifest rather than anonymous per-visitor API requests for large traffic volumes.

## Remaining Risks and Gates

An allowed GitHub link is not proof of a trusted binary. Restrict repository write access, protect release tags, review artifacts, sign installers, and publish checksums. This UI deliberately does not claim downloads are signed or scanned. Local manifest maintenance is a source-control operation, not an unauthenticated public upload endpoint.

The parent desktop fork, extension execution, native voice helper, dependency tree, update delivery, installer signing, and real provider interactions have not been audited by this website review. Perform those reviews before publishing a desktop binary. Browser visual verification, accessibility tooling, load testing, and testing against the eventual real GitHub repository also remain necessary.
