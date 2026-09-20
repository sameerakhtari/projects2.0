import {
  projectSchema,
  type ProjectInput,
  type PublicProject,
  type AdminProject,
} from "./model";

type Row = Record<string, string | number | null>;
type Cell = string | number | null;
export class Conflict extends Error {}
export class Missing extends Error {}
export class InvalidReference extends Error {}
const fields =
  "r.title,r.subtitle,r.summary,r.status,r.domain,r.kind,r.timeframe,r.start_year,r.end_year,r.featured,r.sort_order,r.next_iteration,r.created_at AS revision_created_at";
const childQueries = {
  sections:
    "SELECT s.* FROM project_sections s JOIN selected x ON s.revision_id=x.revision_id ORDER BY s.position",
  updates:
    "SELECT s.* FROM project_updates s JOIN selected x ON s.revision_id=x.revision_id ORDER BY s.position",
  links:
    "SELECT s.* FROM project_links s JOIN selected x ON s.revision_id=x.revision_id ORDER BY s.position",
  technologies:
    "SELECT s.revision_id,t.name FROM project_technologies s JOIN technologies t ON t.id=s.technology_id JOIN selected x ON s.revision_id=x.revision_id ORDER BY s.position",
  relationships:
    "SELECT s.*,p.slug AS target_slug,p.published_revision_id AS target_published,p.deleted_at AS target_deleted FROM project_relationships s JOIN projects p ON p.id=s.target_project_id JOIN selected x ON s.revision_id=x.revision_id",
  nodes:
    "SELECT s.* FROM architecture_nodes s JOIN selected x ON s.revision_id=x.revision_id ORDER BY s.position",
  edges:
    "SELECT s.* FROM architecture_edges s JOIN selected x ON s.revision_id=x.revision_id",
  media:
    "SELECT s.*,m.width,m.height,m.deleted_at FROM project_media s JOIN media m ON m.id=s.media_id JOIN selected x ON s.revision_id=x.revision_id WHERE m.deleted_at IS NULL ORDER BY s.position",
};

export async function readProjects(
  db: D1Database,
  privateView: false,
): Promise<PublicProject[]>;
export async function readProjects(
  db: D1Database,
  privateView: true,
): Promise<AdminProject[]>;
export async function readProjects(
  db: D1Database,
  privateView: boolean,
): Promise<(PublicProject | AdminProject)[]> {
  const pointer = privateView ? "draft_revision_id" : "published_revision_id";
  const selected = `WITH selected AS (SELECT p.id,p.${pointer} AS revision_id FROM projects p WHERE p.deleted_at IS NULL AND p.${pointer} IS NOT NULL)`;
  const main = `${selected} SELECT p.id,p.slug,p.published_at,${fields},r.id AS revision_id${privateView ? ",p.version,p.draft_revision_id,p.published_revision_id,p.updated_at,r.private_notes" : ""} FROM selected s JOIN projects p ON p.id=s.id JOIN project_revisions r ON r.id=s.revision_id AND r.project_id=p.id ORDER BY r.sort_order,r.title`;
  const names = Object.keys(childQueries) as (keyof typeof childQueries)[];
  const results = await db.batch<Row>([
    db.prepare(main),
    ...names.map((k) => db.prepare(`${selected} ${childQueries[k]}`)),
  ]);
  const children = Object.fromEntries(
    names.map((k, i) => [k, results[i + 1].results]),
  ) as Record<keyof typeof childQueries, Row[]>;
  return results[0].results.map((row) => {
    const own = (key: keyof typeof childQueries) =>
      children[key].filter((c) => c.revision_id === row.revision_id);
    const input = projectSchema.parse({
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      summary: row.summary,
      status: row.status,
      domain: row.domain,
      kind: row.kind,
      timeframe: row.timeframe,
      startYear: row.start_year,
      endYear: row.end_year,
      featured: !!row.featured,
      sortOrder: row.sort_order,
      nextIteration: row.next_iteration,
      privateNotes: privateView ? row.private_notes : "",
      sections: own("sections").map((s) => ({
        heading: s.heading,
        body: s.body,
      })),
      updates: own("updates").map((s) => ({
        date: s.date,
        title: s.title,
        body: s.body,
        kind: s.kind,
      })),
      links: own("links").map((s) => ({ label: s.label, url: s.url })),
      technologies: own("technologies").map((s) => s.name),
      relationships: own("relationships")
        .filter((s) => !s.target_deleted && (privateView || s.target_published))
        .map((s) => ({ target: s.target_slug, type: s.type, note: s.note })),
      architecture: {
        nodes: own("nodes").map((s) => ({
          key: s.node_key,
          label: s.label,
          detail: s.detail,
          column: s.column_no,
        })),
        edges: own("edges").map((s) => ({
          from: s.from_key,
          to: s.to_key,
          label: s.label,
        })),
      },
      media: own("media").map((s) => ({
        id: s.media_id,
        alt: s.alt,
        caption: s.caption,
      })),
    });
    if (privateView)
      return {
        ...input,
        id: String(row.id),
        version: Number(row.version),
        draftRevisionId: row.draft_revision_id as string | null,
        publishedRevisionId: row.published_revision_id as string | null,
        updatedAt: String(row.updated_at),
        publishedAt: row.published_at as string | null,
      };
    const { privateNotes: _notes, ...publicInput } = input;
    void _notes;
    return {
      ...publicInput,
      updatedAt: String(row.revision_created_at),
      publishedAt: String(row.published_at),
      media: own("media").map((s) => ({
        id: String(s.media_id),
        alt: String(s.alt),
        caption: String(s.caption),
        width: Number(s.width),
        height: Number(s.height),
      })),
    };
  });
}

const tableColumns = {
  project_sections: ["id", "revision_id", "heading", "body", "position"],
  project_updates: [
    "id",
    "revision_id",
    "date",
    "title",
    "body",
    "kind",
    "position",
  ],
  project_links: ["id", "revision_id", "label", "url", "position"],
  technologies: ["id", "name"],
  project_technologies: ["revision_id", "technology_id", "position"],
  project_relationships: [
    "id",
    "revision_id",
    "target_project_id",
    "type",
    "note",
  ],
  architecture_nodes: [
    "id",
    "revision_id",
    "node_key",
    "label",
    "detail",
    "column_no",
    "position",
  ],
  architecture_edges: ["id", "revision_id", "from_key", "to_key", "label"],
  project_media: [
    "id",
    "revision_id",
    "media_id",
    "alt",
    "caption",
    "position",
  ],
} as const;
function insertRows(
  db: D1Database,
  table: keyof typeof tableColumns,
  rows: Cell[][],
): D1PreparedStatement[] {
  const columns = tableColumns[table];
  const count = Math.floor(90 / columns.length);
  const statements: D1PreparedStatement[] = [];
  for (let offset = 0; offset < rows.length; offset += count) {
    const batch = rows.slice(offset, offset + count);
    const conflict =
      table === "technologies" ? " ON CONFLICT(id) DO NOTHING" : "";
    statements.push(
      db
        .prepare(
          `INSERT INTO ${table} (${columns.join(",")}) VALUES ${batch.map(() => `(${columns.map(() => "?").join(",")})`).join(",")}${conflict}`,
        )
        .bind(...batch.flat()),
    );
  }
  return statements;
}
const uuid = () => crypto.randomUUID();
const techId = (name: string) => name.toLowerCase();
export function auditStatement(
  db: D1Database,
  actor: string,
  action: string,
  projectId: string | null,
  detail: string,
  now = new Date().toISOString(),
) {
  return db
    .prepare(
      "INSERT INTO audit_log (id,actor,action,project_id,detail,created_at) VALUES (?,?,?,?,?,?)",
    )
    .bind(uuid(), actor, action, projectId, detail, now);
}
export function versionGuard(db: D1Database, id: string, expected: number) {
  return db
    .prepare(
      "INSERT INTO project_changes (id,project_id,expected_version) VALUES (?,?,(SELECT version FROM projects WHERE id=? AND version=? AND deleted_at IS NULL))",
    )
    .bind(uuid(), id, id, expected);
}
export function revisionStatements(
  db: D1Database,
  id: string,
  revision: string,
  p: ProjectInput,
  targets: Map<string, string>,
  now: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        "INSERT INTO project_revisions (id,project_id,title,subtitle,summary,status,domain,kind,timeframe,start_year,end_year,featured,sort_order,next_iteration,private_notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        revision,
        id,
        p.title,
        p.subtitle,
        p.summary,
        p.status,
        p.domain,
        p.kind,
        p.timeframe,
        p.startYear,
        p.endYear,
        +p.featured,
        p.sortOrder,
        p.nextIteration,
        p.privateNotes,
        now,
      ),
    ...insertRows(
      db,
      "project_sections",
      p.sections.map((s, i) => [uuid(), revision, s.heading, s.body, i]),
    ),
    ...insertRows(
      db,
      "project_updates",
      p.updates.map((s, i) => [
        uuid(),
        revision,
        s.date,
        s.title,
        s.body,
        s.kind,
        i,
      ]),
    ),
    ...insertRows(
      db,
      "project_links",
      p.links.map((s, i) => [uuid(), revision, s.label, s.url, i]),
    ),
    ...insertRows(
      db,
      "technologies",
      p.technologies.map((t) => [techId(t), t]),
    ),
    ...insertRows(
      db,
      "project_technologies",
      p.technologies.map((t, i) => [revision, techId(t), i]),
    ),
    ...insertRows(
      db,
      "project_relationships",
      p.relationships.map((r) => [
        uuid(),
        revision,
        targets.get(r.target)!,
        r.type,
        r.note,
      ]),
    ),
    ...insertRows(
      db,
      "architecture_nodes",
      p.architecture.nodes.map((n, i) => [
        uuid(),
        revision,
        n.key,
        n.label,
        n.detail,
        n.column,
        i,
      ]),
    ),
    ...insertRows(
      db,
      "architecture_edges",
      p.architecture.edges.map((e) => [
        uuid(),
        revision,
        e.from,
        e.to,
        e.label,
      ]),
    ),
    ...insertRows(
      db,
      "project_media",
      p.media.map((m, i) => [uuid(), revision, m.id, m.alt, m.caption, i]),
    ),
  ];
}
export async function saveProject(
  db: D1Database,
  actor: string,
  input: ProjectInput,
  expected: number,
  existingId?: string,
) {
  const p = projectSchema.parse(input);
  const now = new Date().toISOString();
  const id = existingId ?? uuid();
  const revision = uuid();
  if (!existingId && expected !== 0)
    throw new Conflict("Create a project with version zero.");
  const roots = (
    await db
      .prepare(
        "SELECT id,slug,version,published_at FROM projects WHERE deleted_at IS NULL",
      )
      .all<Row>()
  ).results;
  if (existingId && !roots.some((r) => r.id === id)) throw new Missing();
  if (existingId && !roots.some((r) => r.id === id && r.version === expected))
    throw new Conflict(
      "This project changed in another session. Reload before saving.",
    );
  const original = roots.find((r) => r.id === id);
  if (original?.published_at && original.slug !== p.slug)
    throw new Conflict(
      "A published project keeps its original URL. The title and content can still be edited.",
    );
  if (!existingId && roots.length >= 500)
    throw new Conflict("The archive supports up to 500 projects.");
  const targets = new Map(
    roots.filter((r) => r.id !== id).map((r) => [String(r.slug), String(r.id)]),
  );
  if (p.relationships.some((r) => !targets.has(r.target)))
    throw new InvalidReference(
      "Choose an existing project for each relationship.",
    );
  if (p.media.length) {
    const valid = (
      await db
        .prepare(
          "SELECT id FROM media WHERE project_id=? AND deleted_at IS NULL",
        )
        .bind(id)
        .all<Row>()
    ).results;
    if (p.media.some((m) => !valid.some((v) => v.id === m.id)))
      throw new InvalidReference(
        "An image is missing or belongs to another project.",
      );
  }
  const start = existingId
    ? [versionGuard(db, id, expected)]
    : [
        db
          .prepare(
            "INSERT INTO projects (id,slug,version,created_at,updated_at) VALUES (?,?,0,?,?)",
          )
          .bind(id, p.slug, now, now),
        versionGuard(db, id, 0),
      ];
  try {
    await db.batch([
      ...start,
      ...revisionStatements(db, id, revision, p, targets, now),
      db
        .prepare(
          "UPDATE projects SET slug=?,draft_revision_id=?,version=version+1,updated_at=? WHERE id=?",
        )
        .bind(p.slug, revision, now, id),
      auditStatement(
        db,
        actor,
        existingId ? "draft.saved" : "project.created",
        id,
        `${p.title}; revision ${revision}`,
        now,
      ),
    ]);
  } catch (error) {
    if (/constraint|unique/i.test(String(error)))
      throw new Conflict(
        "The slug is already used, or this project changed. Reload before retrying.",
      );
    throw error;
  }
  return { id, version: expected + 1, revision };
}

export async function changePublication(
  db: D1Database,
  actor: string,
  id: string,
  expected: number,
  action: "publish" | "unpublish" | "delete",
  confirmation?: string,
) {
  const root = await db
    .prepare("SELECT * FROM projects WHERE id=? AND deleted_at IS NULL")
    .bind(id)
    .first<Row>();
  if (!root) throw new Missing();
  if (root.version !== expected)
    throw new Conflict("This project changed. Reload before continuing.");
  if (action !== "publish" && confirmation !== root.slug)
    throw new Conflict("Type the exact project slug to confirm.");
  if (action === "delete" && root.published_revision_id)
    throw new Conflict("Unpublish this project before deleting it.");
  if (action === "publish" && !root.draft_revision_id)
    throw new Conflict("Save a draft first.");
  const now = new Date().toISOString();
  const statement =
    action === "publish"
      ? db
          .prepare(
            "UPDATE projects SET published_revision_id=draft_revision_id,published_at=?,version=version+1,updated_at=? WHERE id=?",
          )
          .bind(now, now, id)
      : action === "unpublish"
        ? db
            .prepare(
              "UPDATE projects SET published_revision_id=NULL,version=version+1,updated_at=? WHERE id=?",
            )
            .bind(now, id)
        : db
            .prepare(
              "UPDATE projects SET deleted_at=?,version=version+1,updated_at=? WHERE id=? AND published_revision_id IS NULL",
            )
            .bind(now, now, id);
  try {
    await db.batch([
      versionGuard(db, id, expected),
      statement,
      auditStatement(
        db,
        actor,
        `project.${action === "delete" ? "deleted" : action === "publish" ? "published" : "unpublished"}`,
        id,
        String(root.slug),
        now,
      ),
    ]);
  } catch (error) {
    if (/constraint/i.test(String(error)))
      throw new Conflict("This project changed. Reload before continuing.");
    throw error;
  }
  return { version: expected + 1 };
}

export async function listAudit(db: D1Database, before?: string) {
  let date: string | null = null,
    id: string | null = null;
  if (before) {
    const parts = before.split("~");
    if (
      parts.length !== 2 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parts[0]) ||
      !/^[0-9a-f-]{36}$/.test(parts[1])
    )
      throw new InvalidReference("The activity cursor is invalid.");
    [date, id] = parts;
  }
  return (
    await db
      .prepare(
        "SELECT id,action,project_id,detail,created_at FROM audit_log WHERE (? IS NULL OR created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC,id DESC LIMIT 50",
      )
      .bind(date, date, date, id)
      .all<Row>()
  ).results;
}
export async function exportContent(db: D1Database) {
  // One D1 batch yields one consistent snapshot, including unpublished revisions.
  const tables = [
    "projects",
    "project_revisions",
    "project_sections",
    "project_updates",
    "project_links",
    "technologies",
    "project_technologies",
    "project_relationships",
    "architecture_nodes",
    "architecture_edges",
    "media",
    "project_media",
    "site_settings",
    "audit_log",
    "project_changes",
  ] as const;
  const data = await db.batch<Row>(
    tables.map((t) => db.prepare(`SELECT * FROM ${t}`)),
  );
  return {
    format: "project-atlas-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: Object.fromEntries(tables.map((t, i) => [t, data[i].results])),
  };
}
