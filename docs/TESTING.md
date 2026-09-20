# Verification record

20 September 2026, Node.js 24.19.0. Verification runs locally; no GitHub Actions or artifact uploads.

## Automated coverage

35 Node tests cover signed Access validity, forged headers, wrong audience/issuer/owner, expiry/nbf/iat/signature/algorithm, CSRF, strict schemas, stored XSS, SQL payloads, streamed size limits, PNG validation/metadata removal, no-store/CORS, draft/relationship/media isolation, optimistic concurrency/rollback, publication/deletion, backups, stable URLs, equal-timestamp audit pagination, malformed configuration and unsupported write methods.

API tests run the actual migration and parameterized SQL on SQLite with foreign keys and transactions. Their R2 adapter is in memory; it is not represented as remote storage verification.

`npm run test:worker` executes the actual final bundle in Cloudflare workerd using Miniflare, with real local D1/R2 and rate-limit bindings. It imports all 13 records; checks every study, public routes/assets/metadata/404s; verifies real RS256 assertions against a simulated trusted JWKS HTTP endpoint; renders owner pages; and exercises draft/publish/unpublish, image visibility and private export. No production authentication code is replaced.

Typecheck, ESLint, production build and source/privacy scan pass. Local Wrangler migration/seed passed. Patched dependency audit reports zero known advisories. Drizzle's old transitive esbuild is overridden with the patched direct version; migration generation must continue to show no unintended schema drift.

The final checks were repeated after a clean `npm ci`: all 35 tests, typecheck, lint, build, built-Worker smoke and scan passed, audit remained at zero, and migration generation reported no schema changes. The production helper rejected missing configuration and successfully built with a temporary synthetic configuration while preserving its settings in the generated Wrangler file. That configuration was removed and the local development build restored; no deployment was attempted.

## Browser and accessibility

During the prior work segment, desktop archive/selected studies/editorial rows/camera architecture were visually reviewed. Docker + active-state filters returned one record, updated the URL, unmatched search showed an empty state, and Clear restored all 13. Case-study/Atlas navigation and native Tab focus to Atlas worked. No application error/CSP violation was observed; unrelated browser-extension diagnostics were excluded. The restored implementation preserves those changes.

The available browser did not expose viewport resizing; attempted normal shortcuts did not change viewport. Responsive CSS, native labels/focus, text diagram alternatives and reduced motion were reviewed, but **actual phone/tablet layouts are not visually certified**. The owner interface is exercised by API/runtime tests; real Access-authenticated browser editing, mobile owner forms and a full screen-reader pass remain live acceptance checks.

Optional WebMCP tools share the public explorer state and validate inputs. This browser reported modelContext unavailable, so live structured-tool invocation validation was unavailable. Normal browsing does not depend on it; WebMCP is not an authorization mechanism.

## Performance and SEO

Worker: approximately 532 KB raw / 140 KB gzip. No browser framework/hydration, remote fonts or analytics. Public assets are CSS, small scripts and SVG favicon. All dynamic/private/media responses intentionally favor immediate publication privacy over caching. Measure deployed CPU/latency before claiming performance targets, especially with a larger archive.

Implemented: page-specific titles/descriptions, trusted-origin canonical URLs, Open Graph/Twitter summary metadata, semantic slugs, nonce JSON-LD, robots, sitemap and 404. No fabricated project photos or generic social image. Check final canonical domain/crawler behavior after deployment.

## Reproduce

```sh
npm ci
npm run verify
npm audit
npm run db:generate
```

Tests write only ignored `.astra-local` bundles. The scanner checks tracked and unignored files for credential patterns, forbidden/generated/private paths, large files, internal seed addresses, nonempty private seed notes and build source maps. Manually review staged diffs too.

## Remaining live gates

Real Access policy/identity/session, actual mobile and authenticated browser behavior, JWKS rotation, WAF rules, remote D1/R2, disabled alternate URLs, CDN overrides, backup restoration and production deployment remain unverified. Follow [DEPLOYMENT.md](DEPLOYMENT.md) before calling the site production-live.
