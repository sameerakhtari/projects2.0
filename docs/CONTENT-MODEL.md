# Content model

A project has stable UUID/slug, optimistic version, draft and optional published revision pointers, timestamps and optional soft deletion. Each immutable revision carries title, subtitle, summary, state, domain, kind, timeframe, optional years, featured/order, next iteration and private notes.

| Tables                                                 | Role                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `projects`, `project_revisions`                        | Identity, concurrency, public/draft pointers and immutable editorial content |
| `project_sections`, `project_updates`, `project_links` | Ordered Markdown sections, dated entries and HTTPS sources                   |
| `technologies`, `project_technologies`                 | Shared vocabulary and ordered revision membership                            |
| `project_relationships`                                | Typed links to existing project identities                                   |
| `architecture_nodes`, `architecture_edges`             | Conceptual systems and validated connections                                 |
| `media`, `project_media`                               | Private object metadata and revision-specific alt/caption/order              |
| `project_changes`                                      | Atomic expected-version claims                                               |
| `audit_log`, `site_settings`                           | Committed actions and seed metadata                                          |

Strict nested Zod schemas reject unknown fields, self/duplicate relationships, missing topology nodes, unsafe links and invalid dates. Bounded arrays, text, JSON bodies and images limit work. SQL values are bound; fixed table/column allowlists control identifiers.

## Editorial semantics

**Built** records an implementation, not guaranteed current uptime. **Evolving** means real ongoing change; **In progress** is unfinished implementation. **Experiment**, **Historical** and **Archived** preserve scope honestly. Dates use YYYY, YYYY-MM or valid YYYY-MM-DD without inventing precision; unknown project years are null. Plans belong in next iteration or explicitly PLANNED updates.

The first two featured records in configured order lead the index; remaining records use compact rows. Once-published slugs cannot change. Use conceptual infrastructure labels, credit upstream work, qualify recorded measurements and exclude private/customer/employer data. Source evidence is documented separately. The seed initializes an empty database only; live editing uses D1.

Relations: EVOLVED_FROM, DEPENDS_ON, INSPIRED, REPLACED, EXTENDS, RELATED_TO and EXPERIMENT_FOR. They resolve to project IDs. Public graphs filter unpublished/deleted targets. Diagrams allow at most four columns and 16 nodes; edges join distinct existing keys. SVG is generated from escaped structured text, not uploaded markup. Text roles/connections provide a mobile and accessibility alternative.

## API contracts

| Method/route                             | Contract                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- |
| GET `/api/projects`                      | Published summaries, filtered by q/domain/status/technology/year/kind |
| GET `/api/projects/:slug`                | Published DTO without private notes/edit IDs                          |
| GET `/api/admin/projects`                | Protected drafts and versions                                         |
| GET `/api/admin/csrf`                    | Protected signed owner-bound token                                    |
| POST `/api/admin/projects`               | `{version:0, project:{…}}` creates private draft                      |
| PUT `/api/admin/projects/:id`            | `{version, project:{…}}` saves new draft                              |
| POST `/api/admin/projects/:id/publish`   | `{version}` advances public pointer                                   |
| POST `/api/admin/projects/:id/unpublish` | `{version, confirmation:slug}` removes public pointer                 |
| POST `/api/admin/projects/:id/delete`    | Same confirmation; only unpublished records                           |
| POST `/api/admin/media`                  | Bounded PNG with project ID and encoded alt headers                   |
| GET `/api/admin/media/:id`               | Protected image; `?download=1` forces attachment                      |
| DELETE `/api/admin/media/:id`            | Strict empty JSON object; only unreferenced image                     |
| GET `/api/admin/export`                  | All-table private JSON backup                                         |
| GET `/media/:id`                         | Current published reference from image's owning project required      |

Administrative mutations require signed Access assertion, owner authorization, exact Origin and X-CSRF-Token. Expected statuses: 400 validation, 403 authentication/CSRF, 404 absent/private, 409 version/confirmation, 413 size, 429 rate, 503 configuration/storage. No wildcard CORS.

Export format `project-atlas-backup`, version 1, contains exportedAt and all fifteen table arrays from one database batch. It includes sensitive drafts/history and excludes R2 bytes. Keep it encrypted outside Git. Operational recovery uses SQL export plus object backup; there is no public JSON import endpoint.
