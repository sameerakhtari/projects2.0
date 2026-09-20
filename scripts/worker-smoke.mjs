import assert from "node:assert/strict";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
// Actual built Worker and local Cloudflare storage; only the trusted JWKS HTTP service is simulated.
await mkdir(".astra-local/smoke", { recursive: true });
await build({
  entryPoints: [
    "src/content/repository.ts",
    "src/content/model.ts",
    "tests/support.ts",
  ],
  outdir: ".astra-local/smoke",
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  packages: "external",
});
const { revisionStatements } =
  await import("../.astra-local/smoke/src/content/repository.mjs");
const { projectSchema } =
  await import("../.astra-local/smoke/src/content/model.mjs");
const { sample, png } = await import("../.astra-local/smoke/tests/support.mjs");
const keys = await generateKeyPair("RS256");
const jwks = {
  keys: [{ ...(await exportJWK(keys.publicKey)), kid: "smoke", alg: "RS256" }],
};
const issuer = "https://smoke-team.cloudflareaccess.com",
  origin = "https://archive.example.com",
  audience = "smoke-application-audience",
  subject = "smoke-owner-subject";
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: "dist/server/index.js",
    compatibilityDate: "2026-05-15",
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
    assets: {
      directory: "dist/client",
      binding: "ASSETS",
      run_worker_first: true,
      routerConfig: {
        has_user_worker: true,
        invoke_user_worker_ahead_of_assets: true,
      },
    },
    bindings: {
      ENVIRONMENT: "production",
      SITE_ORIGIN: origin,
      ACCESS_ISSUER: issuer,
      ACCESS_AUDIENCE: audience,
      ACCESS_OWNER_SUBJECTS: subject,
      CSRF_SECRET: crypto.randomUUID() + crypto.randomUUID(),
    },
    ratelimits: {
      ADMIN_RATE_LIMITER: {
        namespace_id: "999999",
        simple: { limit: 1000, period: 60 },
      },
    },
    outboundService: (request) => {
      assert.equal(request.url, `${issuer}/cdn-cgi/access/certs`);
      return new Response(JSON.stringify(jwks), {
        headers: { "content-type": "application/json" },
      });
    },
  }),
);
try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.batch(
      (await readFile(`drizzle/${file}`, "utf8"))
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
  const projects = JSON.parse(
    await readFile("src/content/seed.json", "utf8"),
  ).map((p) => projectSchema.parse(p));
  const ids = new Map(projects.map((p) => [p.slug, crypto.randomUUID()]));
  const now = new Date().toISOString();
  await db.batch(
    projects.map((p) =>
      db
        .prepare(
          "INSERT INTO projects(id,slug,version,created_at,updated_at) VALUES(?,?,1,?,?)",
        )
        .bind(ids.get(p.slug), p.slug, now, now),
    ),
  );
  for (const p of projects) {
    const id = ids.get(p.slug),
      rev = crypto.randomUUID();
    await db.batch([
      ...revisionStatements(db, id, rev, p, ids, now),
      db
        .prepare(
          "UPDATE projects SET draft_revision_id=?,published_revision_id=?,published_at=? WHERE id=?",
        )
        .bind(rev, rev, now, id),
    ]);
  }
  const token = await new SignJWT({ type: "app" })
    .setProtectedHeader({ alg: "RS256", kid: "smoke" })
    .setSubject(subject)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  const access = { "cf-access-jwt-assertion": token };
  const get = (path, auth = false) =>
    mf.dispatchFetch(`${origin}${path}`, { headers: auth ? access : {} });
  for (const path of [
    "/",
    "/projects",
    "/atlas",
    "/log",
    "/robots.txt",
    "/sitemap.xml",
    ...projects.map((p) => `/projects/${p.slug}`),
  ]) {
    const r = await get(path);
    assert.equal(
      r.status,
      200,
      `${path}: ${r.status === 200 ? "ok" : await r.clone().text()}`,
    );
    assert.equal(r.headers.get("cache-control"), "no-store");
    await r.arrayBuffer();
  }
  assert.equal((await (await get("/api/projects")).json()).total, 13);
  for (const path of ["/admin", "/api/admin/export"])
    assert.equal((await get(path)).status, 403);
  for (const path of [
    "/src/index.tsx",
    "/index.js.map",
    "/.env",
    "/not-a-record",
  ])
    assert.equal((await get(path)).status, 404, path);
  for (const path of [
    "/styles.css",
    "/explore.js",
    "/admin.js",
    "/favicon.svg",
  ]) {
    const r = await get(path);
    assert.equal(r.status, 200, path);
    await r.arrayBuffer();
  }
  const csrf = (await (await get("/api/admin/csrf", true)).json()).token;
  const mutate = (path, body, method = "POST", headers = {}) =>
    mf.dispatchFetch(`${origin}${path}`, {
      method,
      headers: {
        ...access,
        origin,
        "x-csrf-token": csrf,
        "content-type": "application/json",
        ...headers,
      },
      body: body instanceof Uint8Array ? body : JSON.stringify(body),
    });
  const created = await mutate("/api/admin/projects", {
    version: 0,
    project: sample(),
  });
  assert.equal(created.status, 201, await created.clone().text());
  const { id } = await created.json();
  for (const path of [
    "/admin",
    `/admin/projects/${id}`,
    `/admin/preview/${id}`,
    "/admin/media",
    "/admin/audit",
  ])
    assert.equal((await get(path, true)).status, 200, path);
  assert.equal((await get("/api/projects/test-project")).status, 404);
  const image = await mutate("/api/admin/media", png(true), "POST", {
    "content-type": "image/png",
    "x-project-id": id,
    "x-image-alt": "Smoke%20image",
  });
  assert.equal(image.status, 201, await image.clone().text());
  const media = await image.json();
  assert.equal((await get(`/media/${media.id}`)).status, 404);
  assert.equal(
    (
      await mutate(
        `/api/admin/projects/${id}`,
        {
          version: 1,
          project: sample({
            media: [{ id: media.id, alt: "Smoke image", caption: "" }],
          }),
        },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal(
    (await mutate(`/api/admin/projects/${id}/publish`, { version: 2 })).status,
    200,
  );
  assert.equal((await get(`/media/${media.id}`)).status, 200);
  assert(
    !(await (await get("/api/projects/test-project")).text()).includes(
      "PRIVATE-NOTE-SENTINEL",
    ),
  );
  assert.equal(
    (
      await mutate(`/api/admin/projects/${id}/unpublish`, {
        version: 3,
        confirmation: "test-project",
      })
    ).status,
    200,
  );
  assert.equal((await get(`/media/${media.id}`)).status, 404);
  assert.equal(
    (await (await get("/api/admin/export", true)).json()).tables.projects
      .length,
    14,
  );
  console.log(
    "Worker smoke passed: 13 studies, public assets/metadata, real JWT verification, owner pages, D1 publication, R2 visibility and private export.",
  );
} finally {
  await mf.dispose();
}
