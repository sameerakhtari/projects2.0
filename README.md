# Sameer’s Project Archive

A living engineering archive with 13 researched records, linked systems, case studies, a build log and a private owner CMS. Server-rendered HTML and small progressive enhancements keep the public archive usable without JavaScript.

**Status:** implemented and locally verified. Production deployment and real Cloudflare Access policy/identity checks still require account setup. No live deployment is claimed.

## Run locally

Use Node.js 24 LTS and npm in this repository:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Open the local URL printed by Wrangler. `wrangler.jsonc` contains development bindings and a local `SITE_ORIGIN`; set that to your exact local origin when needed. `npm run dev` supports Vite development, but development injection may be blocked by the production CSP. Use the built preview for accurate behavior; do not weaken CSP to accommodate injection.

The seed refuses a nonempty database. D1 is authoritative after import; there is no runtime seed fallback. Local admin remains closed without real signed Access credentials. Automated tests use ephemeral keys and isolated storage, not a development login bypass.

## Routes and editing

- `/` and `/projects`: instant keyword search and shareable domain/state/technology/year/material filters.
- `/projects/:slug`: case study, architecture, sources, updates, media and related work.
- `/atlas`: structured project lineage with a readable text alternative.
- `/log`: milestones, notes, experiments and explicitly planned work.
- `/admin`: protected owner dashboard, editor, previews, publication, media, activity and backup.

Saving a draft never changes the published revision. Access policy and independent server-side signed JWT/owner validation protect every administrative page and API.

## Local release checks

```sh
npm run verify
npm audit
```

`verify` runs typecheck, lint, security/API tests, production build, a workerd/D1/R2 smoke test and source/privacy scanning. [Testing](docs/TESTING.md) records what has and has not been verified.

## Guides

| Guide                                        | Scope                                                 |
| -------------------------------------------- | ----------------------------------------------------- |
| [Architecture](docs/ARCHITECTURE.md)         | Decisions, request boundaries, persistence and limits |
| [Deployment](docs/DEPLOYMENT.md)             | Cloudflare setup, deployment, backup and recovery     |
| [Owner setup](docs/ADMIN-SETUP.md)           | Exact Access boundary and CMS workflow                |
| [Content model](docs/CONTENT-MODEL.md)       | Fields, revisions, relationships and APIs             |
| [Content evidence](docs/CONTENT-EVIDENCE.md) | Sources, current states and unknown historical claims |
| [Threat model](docs/THREAT-MODEL.md)         | Mitigations, assumptions and residual risks           |
| [Security review](docs/SECURITY-REVIEW.md)   | Fifteen explicit questions and findings               |
| [Security policy](SECURITY.md)               | Reporting and maintenance                             |
| [Contributing](CONTRIBUTING.md)              | Source and verification rules                         |

Implementation belongs only to `sameerakhtari/projects2.0`. `portfolio2.0` and the historical projects repository were read-only references and were not modified. Git contains source, migrations and a lockfile; builds, dependencies, local databases, credentials and AI state are excluded. Direct Cloudflare deployment requires no second source repository or GitHub Actions.
