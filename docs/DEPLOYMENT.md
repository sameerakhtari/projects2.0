# Cloudflare deployment

The application is locally verified, not deployed. Account credentials, Access policy, owner identity, D1/R2 resources and final domain were not supplied. Complete these steps in your own Cloudflare account; never paste credentials into chat or commit them.

## Resources and configuration

Use Node.js 24 LTS and `npm ci`. Authenticate Wrangler using your account (`npx wrangler login`) or an appropriately scoped API token kept in your secret environment.

```sh
cp wrangler.production.example.json wrangler.production.json
npx wrangler d1 create YOUR_DATABASE_NAME
npx wrangler r2 bucket create YOUR_PRIVATE_BUCKET_NAME
```

Replace those name placeholders. Fill the ignored production JSON with the real account ID, D1 UUID/name, private bucket name, HTTPS origin, custom domain, Access issuer and audience. Choose an unused positive integer rate-limit namespace. The owner limit is 120 requests per 60 seconds, including admin reads and images; tune deliberately if needed. [Rate binding reference](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Keep `ENVIRONMENT=production`, `assets.run_worker_first=true`, `workers_dev=false`, `preview_urls=false`. Keep R2 public access, r2.dev and bucket custom domains disabled. Do not override dynamic/media no-store in CDN rules. Use a custom domain in a zone you control. Add an Access/WAF rate rule for administrative paths before authentication; the owner binding is not a global anonymous-request quota.

## Access before editing

Follow [ADMIN-SETUP.md](ADMIN-SETUP.md). One self-hosted Access application must cover exact and descendant `/admin` and `/api/admin` paths, with a single-owner allow policy and one audience. Keep the public archive open. Test path matching rather than assuming wildcard behavior.

`ACCESS_ISSUER` and `ACCESS_AUDIENCE` belong in the private config. `ACCESS_OWNER_SUBJECTS` and `CSRF_SECRET` belong in Worker secret storage. Never set production to development to bypass a missing rate binding.

## Migrate and seed

```sh
npx wrangler d1 migrations apply DB --remote --config wrangler.production.json
node scripts/seed.mjs --remote --config wrangler.production.json
```

Review the 13 seed records before first import. Seed refuses nonempty content; it uses multiple CLI statements, so an interrupted first import needs inspection/recovery before retrying. Do not drop an existing production database to silence the guard. D1 becomes authoritative after import.

For future schema changes, generate and inspect SQL with `npm run db:generate`, test the upgrade on a local copy, and take a remote backup. Prefer additive migrations. Apply compatible migrations before deploying new code; never rewrite a production migration.

## Build and deploy

```sh
npm run verify
npm audit
npm run build:production
npm run deploy
```

The production helper rejects missing placeholders/unsafe settings, selects the private config with `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH`, and verifies the generated account/origin/production settings. Deploy rebuilds and explicitly uses `dist/server/wrangler.json`. Never deploy the development config directly. [Vite configuration reference](https://developers.cloudflare.com/workers/vite-plugin/reference/api/).

Once the Worker exists, provision secrets interactively:

```sh
npx wrangler secret put ACCESS_OWNER_SUBJECTS --config wrangler.production.json
npx wrangler secret put CSRF_SECRET --config wrangler.production.json
```

Owner subjects must come from verified Access identity, not a copied email header. A comma-separated list supports deliberate identity rotation. Generate at least 32 random bytes for CSRF using a local cryptographic generator/password manager. Do not put values in shell arguments, history, screenshots or Git. Until configuration is complete, the editor fails closed; no temporary bypass is required.

## Live acceptance

1. Check public index, filters, all studies, graph, log, sitemap and canonical origin over HTTPS.
2. In a signed-out browser, verify `/admin`, `/admin/`, nested editor/media/audit routes, `/api/admin`, `/api/admin/` and all administrative reads/writes are gated.
3. Test an authenticated non-owner and forged identity header; neither may mutate. Test the real owner separately.
4. Save/preview/publish/edit privately/unpublish a harmless record. Inspect a signed-out session after each transition. Test a stale tab conflict.
5. Upload a harmless photo and check private/public/unpublished image access and metadata stripping.
6. Inspect no-store/CSP headers and CDN rules, real phone/tablet layouts, keyboard behavior and authenticated owner forms.
7. Verify session expiry/revocation, JWKS rotation, disabled alternate Worker URLs and private R2 settings.

## Backup and recovery

The protected **Download content backup** action exports all fifteen database tables, including private notes, revisions and audit. Treat it as sensitive, keep it encrypted outside Git. It is a portable JSON export, not a one-click import or image-byte backup.

For a restorable operational backup, pair D1 SQL with R2 objects:

```sh
npx wrangler d1 export DB --remote --config wrangler.production.json --output .astra-local/database-backup.sql
```

Copy R2 using its authenticated S3 API and account-scoped credentials, or download individual normalized images through the protected media library. Preserve keys; keep SQL and bytes in one encrypted dated backup set. Never enable a public bucket to simplify copying. Schedule backups in your own environment; no GitHub Actions workflow is included.

Restore SQL into a **new isolated D1 database** using Wrangler `d1 execute --remote --file ...` and a private recovery config pointing only at the new database. Restore matching objects into a new private bucket. Check counts, relationships, revision pointers, images and owner access before switching production bindings. Do not import a full SQL export into a nonempty/already migrated DB without inspecting its schema statements. D1 Time Travel is additional platform recovery subject to your account retention; it does not restore R2 bytes.

Roll back failed Worker code using Wrangler or Cloudflare's deployment dashboard. Database migrations do not roll back with code. Retain compatible schema or restore separate resources. For accidental publication, unpublish and review copied/cached content. For compromise, revoke Access sessions, rotate account/CSRF credentials and inspect audit/access logs.
