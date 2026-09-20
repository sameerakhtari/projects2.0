# Contributing

Work only in `sameerakhtari/projects2.0`. The historical archive and `portfolio2.0` are read-only references. Do not modify or push either repository.

Use Node.js 24 LTS and `npm ci`; preserve the lockfile and review small coherent changes. Do not add GitHub Actions, build uploads, generated output, dependencies, local databases, private configuration or AI state to Git.

Use the CMS for live content; seed changes only affect new empty installations. Preserve evidence priority: newer explicit owner instructions, verified newer evidence, archive state, structured portfolio data, public repository evidence, then legacy content. Keep proposals, measurements, dates and upstream attribution honest. Exclude customer, employer and private infrastructure details.

Every admin route/API requires signed Access and owner validation. Preserve CSRF, bound SQL, atomic revisions/audit, draft isolation, no-store and strict CSP. No hidden passwords, unsigned-header trust, wildcard CORS or runtime auth bypasses.

Generate migrations with `npm run db:generate`; inspect SQL and test fresh/upgrade paths. Commit migrations and snapshots as source. Never rewrite a migration already deployed.

```sh
npm run format
npm run verify
npm audit
```

The esbuild override patches an obsolete transitive loader from Drizzle Kit. Verify migration generation when changing it. Review public navigation, filters, diagrams/text fallback, keyboard focus and owner forms. Actual phone/tablet and Access browser checks remain deployment gates.

Inspect staged diff/status/files before pushing for credentials, private data, large files, build output, source maps and disabled checks. Ignore rules do not untrack existing files. The source scanner is heuristic, not a substitute for review.
