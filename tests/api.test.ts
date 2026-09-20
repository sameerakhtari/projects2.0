import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createApp } from "../src/index";
import { verifyAccess } from "../src/security/access";
import { sqliteD1, environment, sample, png } from "./support";
import { readProjects } from "../src/content/repository";
import type { ProjectInput } from "../src/content/model";

async function harness() {
  const sql = sqliteD1();
  const env = environment(sql.db);
  const keys = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({
    keys: [
      {
        ...(await exportJWK(keys.publicKey)),
        kid: "integration",
        alg: "RS256",
      },
    ],
  });
  const app = createApp({
    authorize: (req, env) => verifyAccess(req, env, jwks),
  });
  const token = await new SignJWT({ type: "app" })
    .setProtectedHeader({ alg: "RS256", kid: "integration" })
    .setSubject(env.ACCESS_OWNER_SUBJECTS!)
    .setIssuer(env.ACCESS_ISSUER!)
    .setAudience(env.ACCESS_AUDIENCE!)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(keys.privateKey);
  const access = { "cf-access-jwt-assertion": token };
  const get = (path: string, auth = false) =>
    app.request(
      `${env.SITE_ORIGIN}${path}`,
      { headers: auth ? access : {} },
      env,
    );
  const csrf = (
    (await (await get("/api/admin/csrf", true)).json()) as { token: string }
  ).token;
  const send = (
    path: string,
    body: unknown,
    method = "POST",
    extra: Record<string, string> = {},
  ) =>
    app.request(
      `${env.SITE_ORIGIN}${path}`,
      {
        method,
        headers: {
          ...access,
          origin: env.SITE_ORIGIN!,
          "x-csrf-token": csrf,
          "content-type": "application/json",
          ...extra,
        },
        body: JSON.stringify(body),
      },
      env,
    );
  const create = async (project: ProjectInput = sample()) => {
    const response = await send("/api/admin/projects", { version: 0, project });
    assert.equal(response.status, 201, await response.clone().text());
    return (await response.json()) as { id: string; version: number };
  };
  return { ...sql, env, app, token, csrf, access, get, send, create };
}
test("every admin surface rejects unauthenticated direct requests and is never publicly cached", async (t) => {
  const h = await harness();
  t.after(h.close);
  for (const path of [
    "/admin",
    "/admin/projects/new",
    "/admin/preview/guess",
    "/admin/media",
    "/admin/audit",
    "/api/admin/projects",
    "/api/admin/export",
    "/api/admin/media/guess",
    "/api/admin/csrf",
    "/api/admin/unknown",
  ]) {
    const response = await h.get(path);
    assert.equal(response.status, 403, path);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("cdn-cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  const forged = await h.app.request(
    `${h.env.SITE_ORIGIN}/api/admin/projects`,
    {
      method: "POST",
      headers: {
        "cf-access-authenticated-user-email": "owner@example.com",
        "content-type": "application/json",
      },
      body: "{}",
    },
    h.env,
  );
  assert.equal(forged.status, 403);
});
test("owner can create, preview, publish, revise, unpublish and delete without exposing drafts", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { id } = await h.create();
  assert.equal(
    ((await (await h.get("/api/projects")).json()) as { total: number }).total,
    0,
  );
  assert.equal((await h.get("/projects/test-project")).status, 404);
  assert.equal((await h.get(`/admin/preview/${id}`, true)).status, 200);
  assert.equal(
    (await h.send(`/api/admin/projects/${id}/publish`, { version: 1 })).status,
    200,
  );
  const published = await h.get("/api/projects/test-project");
  assert.equal(published.status, 200);
  const json = await published.text();
  assert(!json.includes("PRIVATE-NOTE-SENTINEL"));
  assert(!json.includes("privateNotes"));
  assert(!json.includes("draftRevisionId"));
  const edited = sample({
    title: "UNPUBLISHED-TITLE-SENTINEL",
    summary:
      "A confidential draft summary that must not leak before publication.",
  });
  assert.equal(
    (
      await h.send(
        `/api/admin/projects/${id}`,
        { version: 2, project: edited },
        "PUT",
      )
    ).status,
    200,
  );
  assert(
    !(await (await h.get("/api/projects/test-project")).text()).includes(
      "UNPUBLISHED-TITLE-SENTINEL",
    ),
  );
  assert(
    (await (await h.get(`/admin/preview/${id}`, true)).text()).includes(
      "UNPUBLISHED-TITLE-SENTINEL",
    ),
  );
  assert.equal(
    (
      await h.send(`/api/admin/projects/${id}/delete`, {
        version: 3,
        confirmation: "test-project",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await h.send(`/api/admin/projects/${id}/unpublish`, {
        version: 3,
        confirmation: "wrong",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await h.send(`/api/admin/projects/${id}/unpublish`, {
        version: 3,
        confirmation: "test-project",
      })
    ).status,
    200,
  );
  assert.equal((await h.get("/api/projects/test-project")).status, 404);
  assert.equal(
    (
      await h.send(`/api/admin/projects/${id}/delete`, {
        version: 4,
        confirmation: "test-project",
      })
    ).status,
    200,
  );
  assert.equal((await h.get(`/admin/projects/${id}`, true)).status, 404);
  const actions = h.sqlite
    .prepare("SELECT action FROM audit_log")
    .all()
    .map((row) => row.action);
  assert.deepEqual(actions, [
    "project.created",
    "project.published",
    "draft.saved",
    "project.unpublished",
    "project.deleted",
  ]);
});
test("stale writes and concurrent saves are rejected atomically; audit agrees with committed state", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { id } = await h.create();
  const responses = await Promise.all(
    ["Revision A", "Revision B"].map((title) =>
      h.send(
        `/api/admin/projects/${id}`,
        { version: 1, project: sample({ title }) },
        "PUT",
      ),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    h.sqlite.prepare("SELECT count(*) AS n FROM project_revisions").get()!.n,
    2,
  );
  assert.equal(
    h.sqlite.prepare("SELECT count(*) AS n FROM audit_log").get()!.n,
    2,
  );
  assert.equal(
    (await h.send(`/api/admin/projects/${id}/publish`, { version: 1 })).status,
    409,
  );
});
test("CSRF, mass assignment, invalid JSON/MIME, unsafe links, and unknown IDs fail without writes", async (t) => {
  const h = await harness();
  t.after(h.close);
  assert.equal(
    (
      await h.send(
        "/api/admin/projects",
        { version: 0, project: sample() },
        "POST",
        { origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await h.send(
        "/api/admin/projects",
        { version: 0, project: sample() },
        "POST",
        { "x-csrf-token": "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await h.send("/api/admin/projects", {
        version: 0,
        project: { ...sample(), isAdmin: true },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await h.send("/api/admin/projects", {
        version: 0,
        project: {
          ...sample(),
          links: [{ label: "x", url: "javascript:alert(1)" }],
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await h.send(
        "/api/admin/projects",
        { version: 0, project: sample() },
        "POST",
        { "content-type": "text/plain" },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await h.send(
        "/api/admin/projects/unknown",
        { version: 0, project: sample() },
        "PUT",
      )
    ).status,
    404,
  );
  assert.equal(
    h.sqlite.prepare("SELECT count(*) AS n FROM projects").get()!.n,
    0,
  );
});
test("stored HTML is escaped, Markdown cannot execute, SQL payloads remain data", async (t) => {
  const h = await harness();
  t.after(h.close);
  const payload = `x'); DROP TABLE projects; -- <script>alert(1)</script>`;
  const { id } = await h.create(
    sample({
      title: payload,
      sections: [
        {
          heading: "Markup",
          body: "<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n<script>alert(1)</script>",
        },
      ],
    }),
  );
  assert.equal(
    (await h.send(`/api/admin/projects/${id}/publish`, { version: 1 })).status,
    200,
  );
  const html = await (await h.get("/projects/test-project")).text();
  assert(!html.includes("<script>alert(1)</script>"));
  assert(!html.includes("<img src=x"));
  assert(!html.includes('href="javascript:'));
  assert(html.includes("&lt;script&gt;"));
  assert.equal(
    h.sqlite.prepare("SELECT count(*) AS n FROM projects").get()!.n,
    1,
  );
});
test("relationships to unpublished records are absent from public graph and APIs", async (t) => {
  const h = await harness();
  t.after(h.close);
  await h.create(
    sample({ slug: "private-target", title: "PRIVATE-RELATION-SENTINEL" }),
  );
  const { id } = await h.create(
    sample({
      relationships: [
        {
          target: "private-target",
          type: "EXTENDS",
          note: "PRIVATE-RELATION-NOTE",
        },
      ],
    }),
  );
  await h.send(`/api/admin/projects/${id}/publish`, { version: 1 });
  for (const path of [
    "/api/projects",
    "/api/projects/test-project",
    "/atlas",
    "/projects/test-project",
  ]) {
    const text = await (await h.get(path)).text();
    assert(!text.includes("PRIVATE-RELATION-SENTINEL"));
    assert(!text.includes("PRIVATE-RELATION-NOTE"));
    assert(!text.includes("private-target"));
  }
});
test("PNG upload, attachment and publication respect ownership and private cache boundaries", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { id } = await h.create();
  const upload = await h.app.request(
    `${h.env.SITE_ORIGIN}/api/admin/media`,
    {
      method: "POST",
      headers: {
        ...h.access,
        origin: h.env.SITE_ORIGIN!,
        "x-csrf-token": h.csrf,
        "content-type": "image/png",
        "x-project-id": id,
        "x-image-alt": "A%20test%20pixel",
      },
      body: new Blob([png(true)]),
    },
    h.env,
  );
  assert.equal(upload.status, 201, await upload.clone().text());
  const image = (await upload.json()) as { id: string };
  assert.equal((await h.get(`/media/${image.id}`)).status, 404);
  assert.equal((await h.get(`/api/admin/media/${image.id}`)).status, 403);
  const privateImage = await h.get(`/api/admin/media/${image.id}`, true);
  assert.equal(privateImage.status, 200);
  assert.equal(privateImage.headers.get("cache-control"), "no-store");
  assert(!(await privateImage.text()).includes("private metadata"));
  const p = sample({
    media: [{ id: image.id, alt: "A test pixel", caption: "Test image" }],
  });
  assert.equal(
    (
      await h.send(
        `/api/admin/projects/${id}`,
        { version: 1, project: p },
        "PUT",
      )
    ).status,
    200,
  );
  await h.send(`/api/admin/projects/${id}/publish`, { version: 2 });
  const publicImage = await h.get(`/media/${image.id}`);
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get("content-type"), "image/png");
  assert.equal(publicImage.headers.get("x-content-type-options"), "nosniff");
  assert.equal(publicImage.headers.get("cache-control"), "no-store");
  const other = await h.create(sample({ slug: "other-project" }));
  assert.equal(
    (
      await h.send(
        `/api/admin/projects/${other.id}`,
        {
          version: 1,
          project: sample({ slug: "other-project", media: p.media }),
        },
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal(
    (await h.send(`/api/admin/media/${image.id}`, {}, "DELETE")).status,
    409,
  );
  await h.send(`/api/admin/projects/${id}/unpublish`, {
    version: 3,
    confirmation: "test-project",
  });
  assert.equal((await h.get(`/media/${image.id}`)).status, 404);
});
test("private exports include draft recovery data and require owner authorization", async (t) => {
  const h = await harness();
  t.after(h.close);
  await h.create();
  const response = await h.get("/api/admin/export", true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert(
    response.headers.get("content-disposition")?.startsWith("attachment;"),
  );
  const backup = (await response.json()) as {
    tables: Record<string, unknown[]>;
  };
  assert.equal(backup.tables.projects.length, 1);
  assert(JSON.stringify(backup).includes("PRIVATE-NOTE-SENTINEL"));
  assert.equal((await h.get("/api/admin/export")).status, 403);
});
test("rate limiting and missing production limiter fail closed; public browsing remains open", async (t) => {
  const h = await harness();
  t.after(h.close);
  h.env.ADMIN_RATE_LIMITER = { limit: async () => ({ success: false }) };
  assert.equal((await h.get("/api/admin/projects", true)).status, 429);
  assert.equal((await h.get("/api/projects")).status, 200);
  h.env.ADMIN_RATE_LIMITER = undefined;
  assert.equal((await h.get("/api/admin/projects", true)).status, 503);
});
test("published URLs are stable and readers do not receive private edit metadata", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { id } = await h.create();
  await h.send(`/api/admin/projects/${id}/publish`, { version: 1 });
  assert.equal(
    (
      await h.send(
        `/api/admin/projects/${id}`,
        { version: 2, project: sample({ slug: "different-url" }) },
        "PUT",
      )
    ).status,
    409,
  );
  const [p] = await readProjects(h.env.DB, false);
  assert(!("privateNotes" in p));
  assert(!("version" in p));
  assert(!("draftRevisionId" in p));
});
test("public and owner HTML are semantic and scripts are external under the CSP", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { id } = await h.create();
  await h.send(`/api/admin/projects/${id}/publish`, { version: 1 });
  for (const path of [
    "/",
    "/atlas",
    "/log",
    "/projects/test-project",
    "/admin",
    `/admin/projects/${id}`,
  ]) {
    const response = await h.get(path, path.startsWith("/admin"));
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert(html.startsWith("<!doctype html>"));
    assert(html.includes('id="main"'));
    assert(html.includes('lang="en"'));
    assert(!/ on(?:click|load|error)=/.test(html));
    assert(!html.includes('style="'));
    assert(
      !response.headers
        .get("content-security-policy")
        ?.includes("unsafe-inline"),
    );
  }
});

test("audit pagination retains events with identical timestamps", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { listAudit } = await import("../src/content/repository");
  for (let i = 0; i < 61; i++)
    h.sqlite
      .prepare(
        "INSERT INTO audit_log(id,actor,action,detail,created_at) VALUES(?,?,?,?,?)",
      )
      .run(
        crypto.randomUUID(),
        "test",
        "test.action",
        "Test event",
        "2026-09-20T00:00:00.000Z",
      );
  const first = await listAudit(h.env.DB);
  assert.equal(first.length, 50);
  const last = first.at(-1)!;
  const second = await listAudit(h.env.DB, `${last.created_at}~${last.id}`);
  assert.equal(second.length, 11);
  assert.equal(new Set([...first, ...second].map((r) => r.id)).size, 61);
  assert.equal((await h.get("/admin/audit?before=invalid", true)).status, 400);
});
test("invalid origin configuration fails safely with no-store headers", async (t) => {
  const h = await harness();
  t.after(h.close);
  for (const origin of [
    undefined,
    "not a URL",
    "https://example.com/path",
    "http://example.com",
  ]) {
    h.env.SITE_ORIGIN = origin;
    for (const path of ["/", "/admin", "/api/admin/projects"]) {
      const r = await h.app.request(
        `https://archive.example.com${path}`,
        {},
        h.env,
      );
      assert.equal(r.status, 503);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert(r.headers.get("content-security-policy"));
      assert(!(await r.text()).includes("stack"));
    }
  }
});
test("methods, encoded paths and oversized or active uploads cannot mutate state", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { id } = await h.create();
  for (const method of ["GET", "OPTIONS"]) {
    const r = await h.app.request(
      `${h.env.SITE_ORIGIN}/api/admin/projects/${id}/publish`,
      { method, headers: h.access },
      h.env,
    );
    assert([404, 405].includes(r.status));
  }
  assert.equal((await h.get("/%61dmin")).status, 400);
  const large = await h.app.request(
    `${h.env.SITE_ORIGIN}/api/admin/media`,
    {
      method: "POST",
      headers: {
        ...h.access,
        origin: h.env.SITE_ORIGIN!,
        "x-csrf-token": h.csrf,
        "content-type": "image/png",
        "x-project-id": id,
        "x-image-alt": "Image",
        "content-length": String(6 * 1024 * 1024),
      },
      body: "x",
    },
    h.env,
  );
  assert.equal(large.status, 413);
  const svg = await h.app.request(
    `${h.env.SITE_ORIGIN}/api/admin/media`,
    {
      method: "POST",
      headers: {
        ...h.access,
        origin: h.env.SITE_ORIGIN!,
        "x-csrf-token": h.csrf,
        "content-type": "image/svg+xml",
      },
      body: '<svg onload="alert(1)"/>',
    },
    h.env,
  );
  assert.equal(svg.status, 400);
  assert.equal(
    h.sqlite.prepare("SELECT published_revision_id FROM projects").get()!
      .published_revision_id,
    null,
  );
  assert.equal(h.sqlite.prepare("SELECT count(*) AS n FROM media").get()!.n, 0);
});
test("valid signed Access user outside owner allowlist cannot mutate content", async (t) => {
  const h = await harness();
  t.after(h.close);
  h.env.ACCESS_OWNER_SUBJECTS = "different-owner-subject";
  assert.equal(
    (await h.send("/api/admin/projects", { version: 0, project: sample() }))
      .status,
    403,
  );
  assert.equal((await h.get("/api/admin/export", true)).status, 403);
  assert.equal(
    h.sqlite.prepare("SELECT count(*) AS n FROM projects").get()!.n,
    0,
  );
});
