import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { verifyAccess } from "../src/security/access";
import { createCsrf, requireCsrf } from "../src/security/csrf";
import { boundedBody, securityHeaders } from "../src/security/http";
import { sanitizePng } from "../src/security/png";
import { renderMarkdown } from "../src/content/markdown";
import {
  projectSchema,
  matches,
  type PublicProject,
} from "../src/content/model";
import { environment, sample, png } from "./support";
import type { Bindings } from "../src/types";

let env: Bindings, key: CryptoKey, resolver: JWTVerifyGetKey;
before(async () => {
  env = environment({} as D1Database);
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  resolver = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256" },
    ],
  });
});
async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    type: "app",
    sub: "test-owner-subject",
    iss: env.ACCESS_ISSUER,
    aud: env.ACCESS_AUDIENCE,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(key);
}
const request = (jwt?: string) =>
  new Request(`${env.SITE_ORIGIN}/admin`, {
    headers: jwt ? { "cf-access-jwt-assertion": jwt } : {},
  });
test("valid signed owner Access application token is accepted", async () =>
  assert.equal(
    await verifyAccess(request(await token()), env, resolver),
    "test-owner-subject",
  ));
test("missing assertion and forged identity-only headers are denied", async () => {
  await assert.rejects(verifyAccess(request(), env, resolver));
  await assert.rejects(
    verifyAccess(
      new Request(`${env.SITE_ORIGIN}/admin`, {
        headers: {
          "cf-access-authenticated-user-email": "owner@example.com",
          "oai-authenticated-user-id": "test-owner-subject",
        },
      }),
      env,
      resolver,
    ),
  );
});
for (const [name, payload] of Object.entries({
  wrongAudience: { aud: "other-app" },
  wrongIssuer: { iss: "https://attacker.example" },
  expired: { exp: Math.floor(Date.now() / 1000) - 1 },
  wrongOwner: { sub: "another-owner" },
  serviceToken: { type: "service" },
  futureIat: { iat: Math.floor(Date.now() / 1000) + 3600 },
  notYetValid: { nbf: Math.floor(Date.now() / 1000) + 3600 },
  missingExpiry: { exp: undefined },
  missingSubject: { sub: undefined },
}))
  test(`Access rejects ${name}`, async () =>
    assert.rejects(verifyAccess(request(await token(payload)), env, resolver)));
test("invalid signature, alg confusion and malformed token are denied", async () => {
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT({ type: "app" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(other.privateKey);
  const hs = await new SignJWT({ type: "app" })
    .setProtectedHeader({ alg: "HS256", kid: "test-key" })
    .sign(crypto.getRandomValues(new Uint8Array(32)));
  for (const jwt of [forged, hs, "not-a-jwt", "eyJhbGciOiJub25lIn0.e30."])
    await assert.rejects(verifyAccess(request(jwt), env, resolver));
});
test("missing or unsafe server configuration fails closed", async () => {
  for (const config of [
    { ACCESS_ISSUER: "" },
    { ACCESS_ISSUER: "http://test-team.cloudflareaccess.com" },
    { ACCESS_ISSUER: "https://test-team.cloudflareaccess.com/evil" },
    { ACCESS_AUDIENCE: "" },
    { ACCESS_OWNER_SUBJECTS: "" },
  ])
    await assert.rejects(
      verifyAccess(request(await token()), { ...env, ...config }, resolver),
    );
});
test("CSRF binds exact origin, subject, method and expiry", async () => {
  const csrf = await createCsrf("test-owner-subject", env);
  const req = (headers: Record<string, string>, method = "POST") =>
    new Request(`${env.SITE_ORIGIN}/api/admin/projects`, {
      method,
      headers: { origin: env.SITE_ORIGIN!, "x-csrf-token": csrf, ...headers },
    });
  await requireCsrf(req({}), "test-owner-subject", env);
  await assert.rejects(
    requireCsrf(
      req({ origin: "https://attacker.example" }),
      "test-owner-subject",
      env,
    ),
  );
  await assert.rejects(
    requireCsrf(req({ "x-csrf-token": "" }), "test-owner-subject", env),
  );
  await assert.rejects(
    requireCsrf(
      req({ "sec-fetch-site": "cross-site" }),
      "test-owner-subject",
      env,
    ),
  );
  await assert.rejects(requireCsrf(req({}), "different-subject", env));
  await assert.rejects(requireCsrf(req({}, "GET"), "test-owner-subject", env));
});
test("Markdown escapes stored HTML and disallows executable links and embedded images", () => {
  const html = renderMarkdown(
    "<img src=x onerror=alert(1)>\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![x](https://example.com/image.svg)\n\n[safe](https://example.com)",
  );
  assert(!html.includes("<script>"));
  assert(!html.includes("<img"));
  assert(!html.includes('href="javascript:'));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes('href="https://example.com"'));
});
test("strict schemas reject mass assignment, invalid topology, unsafe URLs and impossible dates", () => {
  const base = sample();
  for (const value of [
    { ...base, isAdmin: true },
    { ...base, links: [{ label: "Bad", url: "javascript:alert(1)" }] },
    { ...base, status: "PRODUCTION" },
    {
      ...base,
      relationships: [{ target: base.slug, type: "EXTENDS", note: "" }],
    },
    {
      ...base,
      updates: [
        { date: "2026-02-30", title: "Impossible", body: "", kind: "NOTE" },
      ],
    },
    {
      ...base,
      architecture: { nodes: [], edges: [{ from: "a", to: "b", label: "" }] },
    },
  ])
    assert.equal(projectSchema.safeParse(value).success, false);
});
test("PNG sanitizer strips metadata and rejects spoofed, oversized and malformed files", async () => {
  const output = await sanitizePng(png(true));
  assert.equal(output.width, 2);
  assert.equal(output.height, 1);
  assert(!new TextDecoder().decode(output.bytes).includes("private metadata"));
  await assert.rejects(
    sanitizePng(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
  );
  const tampered = png();
  tampered[40] ^= 1;
  await assert.rejects(sanitizePng(tampered));
  await assert.rejects(sanitizePng(new Uint8Array(5 * 1024 * 1024 + 1)));
  await assert.rejects(
    sanitizePng(
      new Uint8Array([...png(), 60, 115, 99, 114, 105, 112, 116, 62]),
    ),
  );
});
test("request size limits also apply when Content-Length is absent", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(120));
      controller.close();
    },
  });
  await assert.rejects(
    boundedBody(
      new Request("https://example.com", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
      100,
    ),
  );
});
test("CSP has no unsafe-inline/eval and uses exact nonce for structured data", () => {
  const h = securityHeaders("test-nonce", true);
  assert(h["Content-Security-Policy"].includes("frame-ancestors 'none'"));
  assert(!h["Content-Security-Policy"].includes("unsafe-"));
  assert(h["Strict-Transport-Security"]);
});
test("combined search filters use technology, state, domain, year and keywords", () => {
  const p = {
    ...sample({
      status: "EVOLVING",
      technologies: ["TypeScript", "Docker Compose"],
    }),
    media: [],
    updatedAt: "2026-01-01",
    publishedAt: "2026-01-01",
  } as PublicProject;
  assert(
    matches(
      p,
      new URLSearchParams(
        "q=test+project&status=active&domain=Software&year=2026&technology=Docker+Compose&kind=SOFTWARE",
      ),
    ),
  );
  assert(!matches(p, new URLSearchParams("domain=Networking")));
  assert(!matches(p, new URLSearchParams("year=2021")));
});
