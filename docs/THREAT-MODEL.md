# Threat model

Assume an attacker can read all source, call routes directly, forge unsigned headers, submit hostile text/uploads and race writes. Protect drafts/notes, media, publication integrity, owner identity, credentials and backups. The browser and requests are untrusted. Access, Worker, D1, R2, identity provider and account administration are separate trust boundaries.

| Threat                        | Mitigation                                                                                                  | Residual assumption                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Direct admin/API access       | Central exact/subpath middleware; signed RS256 assertion; owner subject allowlist                           | Real edge policy must be configured; account/session compromise remains powerful          |
| Forged identity/key/algorithm | Fixed issuer JWKS, RS256 only, exact aud/iss/type, required exp/iat/sub; email headers ignored              | Trusted key endpoint and clock; rotation/cache failures can deny legitimate requests      |
| CSRF                          | Signed owner-bound token, exact Origin, fetch-site check, strict content type, no wildcard CORS             | Same-origin script compromise could act as owner                                          |
| Stored XSS                    | Escaped JSX, safe Markdown, no HTML/images, safe links, nonce JSON-LD, restrictive CSP                      | Owner can still publish misleading text or external links                                 |
| SQL/mass assignment           | Bound values, fixed identifiers, strict nested schemas                                                      | Future edits must preserve the boundary                                                   |
| Draft/cache leakage           | Immutable pointers, public field selection and relation/media checks, no-store                              | CDN overrides/public bucket settings and existing downloaded copies remain external risks |
| Active/malformed images       | Narrow bounded PNG, CRC/dimension/decompression/filter checks, metadata removal, UUID keys, nosniff/sandbox | Decoder bugs/DoS are not eliminated; authenticated rate limits reduce exposure            |
| Overwrite/deletion            | Atomic expected-version guard + audit, separate publish, typed slug, retained revisions                     | No automatic merge or one-click undelete; deliberate owner actions remain possible        |
| DoS                           | Bounded content/requests/images, owner rate binding and JWKS cache bounds                                   | Access/WAF before-auth rules and account quotas need operator configuration               |
| Supply chain                  | Exact lockfile, audit, patched overrides, local verification, no remote runtime scripts                     | Clean audit is dated and not proof of absence                                             |
| Secrets/backups               | Platform secrets, ignored private files, pattern/path scanning, manual review                               | Scans are heuristic; encrypted storage and terminal hygiene are required                  |

No unhackability claim. An account administrator can change policy/code/database; an owner session can publish. The audit is transactional, not tamper-proof against administrators. No malware scanning or automatic screenshot redaction is provided. History retention favors recovery, not automatic erasure.

D1 and R2 do not share a transaction. Failed cleanup can leave unreachable private objects. Reconcile against database metadata and backups; historical revisions can retain valid references. Do not purge merely because an image is absent from current public pages.

Maintain dependency patches, monitor usage, revoke compromised sessions, rotate secrets, recheck owner/non-owner access after policy changes and rehearse recovery into isolated resources. Never introduce an auth-disable flag for convenience.
