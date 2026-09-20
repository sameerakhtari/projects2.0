# Security policy

This public-source application uses Cloudflare Access plus independent signed assertion/owner validation, CSRF, strict schemas, parameterized D1 changes and publication-aware private R2. Read the [threat model](docs/THREAT-MODEL.md) and [review](docs/SECURITY-REVIEW.md) before deployment.

Do not post tokens, private drafts, personal data or working credentials in public issues. If GitHub private vulnerability reporting is enabled, use **Security → Report a vulnerability**. Otherwise contact the owner through an established private channel; no unverified reporting email is invented. Nonsensitive hardening suggestions may use public issues.

Security fixes target main; no formal response-time or independent penetration-test certification is claimed. Keep Access policy, owner identity, MFA/session settings, private storage, disabled alternate URLs, headers, backups and dependencies maintained. Local tests cannot certify account configuration. Never commit credentials/backups or add a development authentication bypass.
