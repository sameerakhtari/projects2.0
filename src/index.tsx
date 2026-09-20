import { Hono } from "hono";
import { z, ZodError } from "zod";
import { raw } from "hono/html";
import type { Context } from "hono";
import type { AppEnv, Bindings } from "./types";
import { verifyAccess, AccessDenied, auditActor } from "./security/access";
import { createCsrf, requireCsrf, trustedOrigin } from "./security/csrf";
import { securityHeaders, boundedBody, BodyTooLarge } from "./security/http";
import { sanitizePng, InvalidImage } from "./security/png";
import {
  commandSchema,
  matches,
  saveSchema,
  type PublicProject,
} from "./content/model";
import {
  auditStatement,
  changePublication,
  Conflict,
  exportContent,
  InvalidReference,
  listAudit,
  Missing,
  readProjects,
  saveProject,
} from "./content/repository";
import { Layout } from "./views/shared";
import { Archive, Atlas, BuildLog, CaseStudy, ErrorPage } from "./views/public";
import { AuditPage, Dashboard, Editor, MediaPage } from "./views/admin";

type C = Context<AppEnv>;
type Row = Record<string, string | number | null>;
type Dependencies = { authorize?: typeof verifyAccess };
function page(
  c: C,
  title: string,
  description: string,
  children: Parameters<typeof Layout>[0]["children"],
  options: { admin?: boolean; noindex?: boolean; structured?: object } = {},
) {
  return c.html(
    <>
      {raw("<!doctype html>")}
      <Layout
        title={title}
        description={description}
        origin={trustedOrigin(c.env)}
        path={c.req.path}
        nonce={c.get("nonce")}
        {...options}
      >
        {children}
      </Layout>
    </>,
  );
}
async function readJson(c: C) {
  if (c.req.header("content-type")?.split(";")[0].trim() !== "application/json")
    throw new InvalidReference("Send application/json.");
  const bytes = await boundedBody(c.req.raw, 256 * 1024);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidReference("The JSON body is invalid.");
  }
}
function fail(
  c: C,
  status: 400 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
  error: string,
) {
  return c.json({ error }, status);
}
function owner(c: C) {
  return c.get("owner");
}
async function csrf(c: C) {
  return createCsrf(owner(c), c.env);
}
const adminRoute = (path: string) =>
  path === "/admin" ||
  path.startsWith("/admin/") ||
  path === "/api/admin" ||
  path.startsWith("/api/admin/");
const mediaQuery =
  "SELECT m.*,r.title AS project_title FROM media m JOIN projects p ON p.id=m.project_id JOIN project_revisions r ON r.id=p.draft_revision_id AND r.project_id=p.id WHERE m.deleted_at IS NULL AND p.deleted_at IS NULL";

export function createApp(dependencies: Dependencies = {}) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    c.set("nonce", nonce);
    const privatePath = adminRoute(c.req.path);
    c.header("Cache-Control", "no-store");
    c.header("CDN-Cache-Control", "no-store");
    for (const [key, value] of Object.entries(
      securityHeaders(nonce, c.req.url.startsWith("https:")),
    ))
      c.header(key, value);
    if (privatePath) c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    try {
      trustedOrigin(c.env);
    } catch {
      return fail(c, 503, "The archive configuration is incomplete.");
    }
    if (/[%\\\x00]/.test(new URL(c.req.url).pathname))
      return fail(c, 400, "Invalid path.");
    if (
      c.req.method === "OPTIONS" ||
      c.req.method === "TRACE" ||
      c.req.method === "CONNECT"
    )
      return c.json({ error: "Method not allowed." }, 405);
    if (privatePath) {
      try {
        const subject = await (dependencies.authorize ?? verifyAccess)(
          c.req.raw,
          c.env,
        );
        c.set("owner", subject);
        if (!c.env.ADMIN_RATE_LIMITER && c.env.ENVIRONMENT !== "development")
          return fail(c, 503, "The editor is temporarily unavailable.");
        if (
          c.env.ADMIN_RATE_LIMITER &&
          !(
            await c.env.ADMIN_RATE_LIMITER.limit({
              key: `owner:${await auditActor(subject)}`,
            })
          ).success
        ) {
          c.header("Retry-After", "60");
          return fail(c, 429, "Too many requests. Try again in one minute.");
        }
        if (!["GET", "HEAD"].includes(c.req.method))
          await requireCsrf(c.req.raw, subject, c.env);
      } catch (error) {
        if (!(error instanceof AccessDenied)) throw error;
        if (c.req.path.startsWith("/api/"))
          return fail(
            c,
            403,
            "Owner access or request verification failed. Your unsaved input is unchanged.",
          );
        c.status(403);
        return page(
          c,
          "Owner access",
          "Private project administration.",
          <ErrorPage
            code="PRIVATE WORKSPACE"
            title="Owner access only."
            body="Sign in through the configured Cloudflare Access application to open this workspace."
          />,
          { admin: true },
        );
      }
    }
    await next();
  });

  app.get("/", async (c) => {
    const projects = await readProjects(c.env.DB, false);
    return page(
      c,
      "Systems take shape",
      "Sameer Akhtari’s technical project archive: infrastructure, software and the experiments in between.",
      <Archive projects={projects} query={new URL(c.req.url).searchParams} />,
      {
        structured: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Sameer’s Project Archive",
          url: trustedOrigin(c.env),
          author: { "@type": "Person", name: "Sameer Akhtari" },
        },
      },
    );
  });
  app.get("/projects", async (c) =>
    page(
      c,
      "The project index",
      "Explore technical projects by domain, technology, state and year.",
      <Archive
        projects={await readProjects(c.env.DB, false)}
        query={new URL(c.req.url).searchParams}
      />,
    ),
  );
  app.get("/atlas", async (c) =>
    page(
      c,
      "A system of systems",
      "Explore the relationships and lineage connecting the project archive.",
      <Atlas projects={await readProjects(c.env.DB, false)} />,
    ),
  );
  app.get("/log", async (c) =>
    page(
      c,
      "A record of change",
      "Dated milestones, experiments and next steps from the project archive.",
      <BuildLog projects={await readProjects(c.env.DB, false)} />,
    ),
  );
  app.get("/projects/:slug", async (c) => {
    const projects = await readProjects(c.env.DB, false);
    const project = projects.find((p) => p.slug === c.req.param("slug"));
    if (!project) return c.notFound();
    return page(
      c,
      project.title,
      project.summary,
      <CaseStudy project={project} projects={projects} />,
      {
        structured: {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: project.title,
          description: project.summary,
          url: `${trustedOrigin(c.env)}/projects/${project.slug}`,
          dateModified: project.updatedAt,
          creator: { "@type": "Person", name: "Sameer Akhtari" },
          keywords: project.technologies,
        },
      },
    );
  });
  app.get("/api/projects", async (c) => {
    const projects = (await readProjects(c.env.DB, false)).filter((p) =>
      matches(p, new URL(c.req.url).searchParams),
    );
    return c.json({
      projects: projects.map((p) => ({
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        summary: p.summary,
        status: p.status,
        domain: p.domain,
        kind: p.kind,
        timeframe: p.timeframe,
        startYear: p.startYear,
        endYear: p.endYear,
        technologies: p.technologies,
        featured: p.featured,
        relationships: p.relationships,
      })),
      total: projects.length,
    });
  });
  app.get("/api/projects/:slug", async (c) => {
    const p = (await readProjects(c.env.DB, false)).find(
      (p) => p.slug === c.req.param("slug"),
    );
    return p ? c.json(p) : fail(c, 404, "Project not found.");
  });

  app.get("/admin", async (c) => {
    const [projects, audit] = await Promise.all([
      readProjects(c.env.DB, true),
      listAudit(c.env.DB),
    ]);
    return page(
      c,
      "Owner workspace",
      "Private project content management.",
      <Dashboard projects={projects} audit={audit} csrf={await csrf(c)} />,
      { admin: true },
    );
  });
  app.get("/admin/projects/new", async (c) =>
    page(
      c,
      "New project",
      "Create a private project draft.",
      <Editor
        projects={await readProjects(c.env.DB, true)}
        available={[]}
        csrf={await csrf(c)}
      />,
      { admin: true },
    ),
  );
  app.get("/admin/projects/:id", async (c) => {
    const projects = await readProjects(c.env.DB, true);
    const project = projects.find((p) => p.id === c.req.param("id"));
    if (!project) return c.notFound();
    const available = (
      await c.env.DB.prepare(
        `${mediaQuery} AND m.project_id=? ORDER BY m.created_at DESC`,
      )
        .bind(project.id)
        .all<Row>()
    ).results;
    return page(
      c,
      `Edit ${project.title}`,
      "Edit a private draft.",
      <Editor
        project={project}
        projects={projects}
        available={available}
        csrf={await csrf(c)}
      />,
      { admin: true },
    );
  });
  app.get("/admin/preview/:id", async (c) => {
    const projects = await readProjects(c.env.DB, true);
    const p = projects.find((p) => p.id === c.req.param("id"));
    if (!p) return c.notFound();
    const media = (
      await c.env.DB.prepare(
        "SELECT id,width,height FROM media WHERE project_id=? AND deleted_at IS NULL",
      )
        .bind(p.id)
        .all<Row>()
    ).results;
    const preview: PublicProject = {
      ...p,
      publishedAt: p.publishedAt ?? p.updatedAt,
      media: p.media.map((m) => ({
        ...m,
        width: Number(media.find((r) => r.id === m.id)?.width ?? 1),
        height: Number(media.find((r) => r.id === m.id)?.height ?? 1),
      })),
    };
    const related: PublicProject[] = projects.map((p) => ({
      ...p,
      publishedAt: p.publishedAt ?? p.updatedAt,
      media: [],
    }));
    return page(
      c,
      `Preview: ${p.title}`,
      p.summary,
      <CaseStudy project={preview} projects={related} preview />,
      { admin: true },
    );
  });
  app.get("/admin/audit", async (c) =>
    page(
      c,
      "Activity history",
      "Private administrative activity.",
      <AuditPage rows={await listAudit(c.env.DB, c.req.query("before"))} />,
      { admin: true },
    ),
  );
  app.get("/admin/media", async (c) =>
    page(
      c,
      "Project media",
      "Private uploaded images.",
      <MediaPage
        media={
          (
            await c.env.DB.prepare(
              `${mediaQuery} ORDER BY m.created_at DESC`,
            ).all<Row>()
          ).results
        }
        csrf={await csrf(c)}
      />,
      { admin: true },
    ),
  );
  app.get("/api/admin/csrf", async (c) => c.json({ token: await csrf(c) }));
  app.get("/api/admin/projects", async (c) =>
    c.json({ projects: await readProjects(c.env.DB, true) }),
  );
  app.post("/api/admin/projects", async (c) => {
    const { project, version } = saveSchema.parse(await readJson(c));
    return c.json(
      await saveProject(c.env.DB, await auditActor(owner(c)), project, version),
      201,
    );
  });
  app.put("/api/admin/projects/:id", async (c) => {
    const { project, version } = saveSchema.parse(await readJson(c));
    return c.json(
      await saveProject(
        c.env.DB,
        await auditActor(owner(c)),
        project,
        version,
        c.req.param("id"),
      ),
    );
  });
  for (const action of ["publish", "unpublish", "delete"] as const)
    app.post(`/api/admin/projects/:id/${action}`, async (c) => {
      const { version, confirmation } = commandSchema.parse(await readJson(c));
      return c.json(
        await changePublication(
          c.env.DB,
          await auditActor(owner(c)),
          c.req.param("id"),
          version,
          action,
          confirmation,
        ),
      );
    });
  app.get("/api/admin/export", async (c) => {
    const data = await exportContent(c.env.DB);
    c.header(
      "Content-Disposition",
      `attachment; filename="project-atlas-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return c.json(data);
  });
  app.post("/api/admin/media", async (c) => {
    if (c.req.header("content-type") !== "image/png")
      return fail(c, 400, "The server accepts normalized PNG images only.");
    const projectId = z
      .string()
      .min(1)
      .max(80)
      .parse(c.req.header("x-project-id"));
    let alt: string;
    try {
      alt = z
        .string()
        .trim()
        .min(1)
        .max(400)
        .parse(decodeURIComponent(c.req.header("x-image-alt") || ""));
    } catch {
      throw new InvalidReference("Supply valid image alt text.");
    }
    const root = await c.env.DB.prepare(
      "SELECT id FROM projects WHERE id=? AND deleted_at IS NULL",
    )
      .bind(projectId)
      .first();
    if (!root) throw new Missing();
    const count = await c.env.DB.prepare(
      "SELECT count(*) AS n FROM media WHERE project_id=? AND deleted_at IS NULL",
    )
      .bind(projectId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 100)
      return fail(c, 400, "A project may hold up to 100 uploaded images.");
    const normalized = await sanitizePng(
      await boundedBody(c.req.raw, 5 * 1024 * 1024),
    );
    const id = crypto.randomUUID();
    const key = `images/${id}.png`;
    const now = new Date().toISOString();
    await c.env.BUCKET.put(key, normalized.bytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
    });
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO media (id,project_id,object_key,mime,bytes,width,height,alt,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ).bind(
          id,
          projectId,
          key,
          "image/png",
          normalized.bytes.length,
          normalized.width,
          normalized.height,
          alt,
          now,
        ),
        auditStatement(
          c.env.DB,
          await auditActor(owner(c)),
          "media.uploaded",
          projectId,
          id,
          now,
        ),
      ]);
    } catch (error) {
      await c.env.BUCKET.delete(key);
      throw error;
    }
    return c.json(
      { id, alt, width: normalized.width, height: normalized.height },
      201,
    );
  });
  app.delete("/api/admin/media/:id", async (c) => {
    z.object({})
      .strict()
      .parse(await readJson(c));
    const id = z.string().uuid().parse(c.req.param("id"));
    const media = await c.env.DB.prepare("SELECT * FROM media WHERE id=?")
      .bind(id)
      .first<Row>();
    if (!media) throw new Missing();
    const reference = await c.env.DB.prepare(
      "SELECT id FROM project_media WHERE media_id=? LIMIT 1",
    )
      .bind(id)
      .first();
    if (reference)
      throw new Conflict(
        "This image is retained by a saved revision. It cannot be deleted.",
      );
    try {
      await c.env.DB.batch([
        c.env.DB.prepare("DELETE FROM media WHERE id=?").bind(id),
        auditStatement(
          c.env.DB,
          await auditActor(owner(c)),
          "media.deleted",
          String(media.project_id),
          id,
        ),
      ]);
    } catch (error) {
      if (/constraint/i.test(String(error)))
        throw new Conflict(
          "This image was attached to a revision. Reload before deleting.",
        );
      throw error;
    }
    await c.env.BUCKET.delete(String(media.object_key));
    return c.json({ deleted: true });
  });
  async function image(c: C, privateView: boolean) {
    const id = c.req.param("id");
    if (!z.string().uuid().safeParse(id).success)
      return fail(c, 404, "Image not found.");
    const sql = privateView
      ? "SELECT m.* FROM media m WHERE m.id=? AND m.deleted_at IS NULL"
      : "SELECT m.* FROM media m JOIN project_media pm ON pm.media_id=m.id JOIN projects p ON p.published_revision_id=pm.revision_id JOIN project_revisions r ON r.id=pm.revision_id AND r.project_id=p.id WHERE m.id=? AND m.deleted_at IS NULL AND p.deleted_at IS NULL AND m.project_id=p.id LIMIT 1";
    const row = await c.env.DB.prepare(sql).bind(id).first<Row>();
    if (!row) return fail(c, 404, "Image not found.");
    const object = await c.env.BUCKET.get(String(row.object_key));
    if (!object) return fail(c, 404, "Image not found.");
    c.header("Content-Type", "image/png");
    c.header(
      "Content-Disposition",
      `${privateView && c.req.query("download") === "1" ? "attachment" : "inline"}; filename="${id}.png"`,
    );
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; sandbox; frame-ancestors 'none'",
    );
    return c.body(object.body);
  }
  app.get("/media/:id", (c) => image(c, false));
  app.get("/api/admin/media/:id", (c) => image(c, true));
  app.get("/robots.txt", (c) =>
    c.text(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${trustedOrigin(c.env)}/sitemap.xml\n`,
    ),
  );
  app.get("/sitemap.xml", async (c) => {
    const projects = await readProjects(c.env.DB, false);
    const origin = trustedOrigin(c.env);
    c.header("Content-Type", "application/xml; charset=utf-8");
    const paths = [
      "/",
      "/projects",
      "/atlas",
      "/log",
      ...projects.map((p) => `/projects/${p.slug}`),
    ];
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`,
    );
  });
  for (const asset of [
    "/styles.css",
    "/explore.js",
    "/admin.js",
    "/favicon.svg",
  ])
    app.get(asset, async (c) => {
      if (!c.env.ASSETS) return c.notFound();
      const response = await c.env.ASSETS.fetch(c.req.raw);
      c.header("Cache-Control", "public, max-age=3600");
      c.header("CDN-Cache-Control", "public, max-age=3600");
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          ...Object.fromEntries(c.res.headers),
        },
      });
    });
  app.notFound((c) => {
    c.status(404);
    if (c.req.path.startsWith("/api/"))
      return c.json({ error: "Not found." }, 404);
    return page(
      c,
      "Record not found",
      "This record is not available.",
      <ErrorPage
        code="404 / NOT IN THE INDEX"
        title="An uncharted page."
        body="This address does not lead to a published record. Explore the index to pick up another thread."
      />,
      { noindex: true, admin: adminRoute(c.req.path) },
    );
  });
  app.onError((error, c) => {
    if (error instanceof ZodError)
      return fail(
        c,
        400,
        error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" · "),
      );
    if (error instanceof BodyTooLarge)
      return fail(c, 413, "The request is too large.");
    if (error instanceof InvalidReference || error instanceof InvalidImage)
      return fail(c, 400, error.message);
    if (error instanceof Conflict) return fail(c, 409, error.message);
    if (error instanceof Missing) return fail(c, 404, "Record not found.");
    if (error instanceof AccessDenied)
      return fail(c, 403, "Request verification failed.");
    console.error(
      JSON.stringify({
        event: "request.failed",
        id: crypto.randomUUID(),
        type: error.name,
      }),
    );
    if (c.req.path.startsWith("/api/"))
      return fail(
        c,
        503,
        "The archive is temporarily unavailable. Please try again.",
      );
    c.status(503);
    return page(
      c,
      "Temporarily unavailable",
      "The archive is temporarily unavailable.",
      <ErrorPage
        code="PLEASE TRY AGAIN"
        title="A pause in the archive."
        body="The content service could not be reached. Your changes have not been discarded; please try again shortly."
      />,
      { noindex: true, admin: adminRoute(c.req.path) },
    );
  });
  return app;
}
const app = createApp();
export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) =>
    app.fetch(request, env, ctx),
};
