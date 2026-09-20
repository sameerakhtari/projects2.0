# Owner setup and editing

## Configure the Access boundary

In Cloudflare Zero Trust, create one **self-hosted application** with destinations covering all of:

| Destination               | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `YOUR_DOMAIN/admin`       | Dashboard root                                    |
| `YOUR_DOMAIN/admin/*`     | Editor, preview, media and audit                  |
| `YOUR_DOMAIN/api/admin`   | API root                                          |
| `YOUR_DOMAIN/api/admin/*` | Every administrative read/write and private image |

Use one application so both route families share the same audience. Check exact roots, trailing slashes and nested paths; wildcard behavior must be verified in your dashboard. Do not protect only the HTML editor. Public project/atlas/log/API/media paths remain open, with image delivery independently checking publication.

Create a single **Allow** policy for your exact owner identity through the identity provider. Use MFA where supported. Do not use Everyone, a domain-wide allow, Bypass or Service Auth. Test a separate non-owner identity. A short session, such as one hour, limits exposure. Access owns login cookies; this application adds no login cookie.

Copy the application's AUD to `ACCESS_AUDIENCE`. Set exact `ACCESS_ISSUER=https://YOUR-TEAM.cloudflareaccess.com` without a trailing slash. The Worker fetches keys only from its fixed `/cdn-cgi/access/certs`; no client-selected key endpoint is trusted. [Cloudflare validation guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Determine the owner's `sub` from an authenticated Access assertion whose signature/issuer/audience you verify against the team's JWKS. Do not paste live tokens into public decoders. Cloudflare's identity/diagnostic tools or your own local verification can establish the subject. Store the exact value using `wrangler secret put ACCESS_OWNER_SUBJECTS`. Email headers are not identity proof. An identity-provider migration may change the subject; deliberately update and retest the secret.

Set a separate random `CSRF_SECRET` using platform secrets (at least 32 random bytes recommended). Editing tokens are signed, owner-bound and valid for two hours; browser code renews before writes after an hour. If Access expires, keep the current page open, reauthenticate in another tab and retry. Copy unsaved work before any unavoidable reload. Private draft text is not persisted to browser local storage.

## CMS workflow

1. Open `/admin` through Access; search records or create a project.
2. Enter title, unique slug, summary, state, domain, dates and technologies. Markdown sections support formatting, not raw HTML or embedded images.
3. Add HTTPS sources, dated updates, relationships and conceptual diagram nodes/edges. Preserve unknown dates and distinguish plans from results.
4. **Save draft** creates an immutable revision and leaves the public version unchanged.
5. Open **Preview draft** after saving. Check text, sources, diagrams, images and alt text.
6. **Publish saved draft** explicitly replaces the public pointer after confirmation. Later saved edits stay private until published again.
7. Type the exact slug to **Unpublish**. Only then may you soft-delete the record with a second explicit action. A published slug remains stable.

Stale tabs receive a conflict instead of overwriting newer work. Preserve input, review the latest version in another tab and merge deliberately. Dirty forms warn before navigation and block publication changes. No automatic merge, autosave or blind retry exists.

## Media

Save the project before uploading. Choose JPEG, WebP or PNG under 15 MB and provide meaningful alt text. The browser resizes to at most 2048 pixels per side / 3 megapixels and converts to PNG under 5 MB. The server independently verifies PNG structure, checksums, dimensions, decompressed size and pixel filters, and removes metadata. It accepts only 8-bit noninterlaced RGB/RGBA PNG, never SVG or HTML.

Upload remains private until attached, saved and published. Save after uploading. Alt text, caption and order are revision-specific. The media library downloads normalized bytes privately. An image referenced by any saved revision cannot be deleted; unreferenced uploads can be deleted after confirmation. Unpublish stops future public delivery but cannot revoke prior downloads.

## Activity, backups and troubleshooting

Activity lists committed changes in stable timestamp-and-ID order; hashed actor identifiers are stored, never tokens/emails. The JSON backup includes private notes/history. Image bytes are separate. Use the SQL + R2 recovery process in [DEPLOYMENT.md](DEPLOYMENT.md).

| Symptom                       | Check                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Login loops                   | Access destinations, identity provider, allow policy and session; never add Bypass |
| Login succeeds, editor denied | Exact issuer/audience/app token type/owner subject                                 |
| 503                           | Production rate binding, exact origin, database availability                       |
| Save denied                   | Origin, session/token expiry, owner config and CSRF secret                         |
| Conflict                      | Another save/publication occurred; preserve and merge input                        |
| Image rejected                | Type, size, dimensions and alt text; use editor normalization                      |
| Public image missing          | Current published revision must reference its own project's image                  |
