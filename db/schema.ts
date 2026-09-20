import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    draftRevisionId: text("draft_revision_id"),
    publishedRevisionId: text("published_revision_id"),
    version: integer("version").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    publishedAt: text("published_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("idx_projects_published").on(t.publishedRevisionId, t.deletedAt),
  ],
);

export const revisions = sqliteTable(
  "project_revisions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull(),
    domain: text("domain").notNull(),
    kind: text("kind").notNull(),
    timeframe: text("timeframe").notNull(),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(100),
    nextIteration: text("next_iteration").notNull().default(""),
    privateNotes: text("private_notes").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_revisions_project").on(t.projectId)],
);

export const sections = sqliteTable(
  "project_sections",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    heading: text("heading").notNull(),
    body: text("body").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("idx_sections_revision").on(t.revisionId, t.position)],
);
export const updates = sqliteTable(
  "project_updates",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    date: text("date").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("idx_updates_revision").on(t.revisionId, t.position)],
);
export const links = sqliteTable(
  "project_links",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    label: text("label").notNull(),
    url: text("url").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("idx_links_revision").on(t.revisionId, t.position)],
);
export const technologies = sqliteTable("technologies", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});
export const projectTechnologies = sqliteTable(
  "project_technologies",
  {
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    technologyId: text("technology_id")
      .notNull()
      .references(() => technologies.id),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("idx_project_technologies_unique").on(
      t.revisionId,
      t.technologyId,
    ),
  ],
);
export const relationships = sqliteTable(
  "project_relationships",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    targetProjectId: text("target_project_id")
      .notNull()
      .references(() => projects.id),
    type: text("type").notNull(),
    note: text("note").notNull(),
  },
  (t) => [
    index("idx_relationships_revision").on(t.revisionId),
    index("idx_relationships_target").on(t.targetProjectId),
  ],
);
export const nodes = sqliteTable(
  "architecture_nodes",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    key: text("node_key").notNull(),
    label: text("label").notNull(),
    detail: text("detail").notNull(),
    column: integer("column_no").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("idx_nodes_revision_key").on(t.revisionId, t.key)],
);
export const edges = sqliteTable(
  "architecture_edges",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    from: text("from_key").notNull(),
    to: text("to_key").notNull(),
    label: text("label").notNull(),
  },
  (t) => [index("idx_edges_revision").on(t.revisionId)],
);
export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    objectKey: text("object_key").notNull().unique(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    alt: text("alt").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("idx_media_project").on(t.projectId, t.deletedAt)],
);
export const projectMedia = sqliteTable(
  "project_media",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id),
    alt: text("alt").notNull(),
    caption: text("caption").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    index("idx_project_media_revision").on(t.revisionId, t.position),
    index("idx_project_media_media").on(t.mediaId),
  ],
);
export const audit = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    projectId: text("project_id"),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_audit_created").on(t.createdAt)],
);
// Every mutation consumes exactly one version; a stale or concurrent write rolls back the batch.
export const changes = sqliteTable(
  "project_changes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    expectedVersion: integer("expected_version").notNull(),
  },
  (t) => [
    uniqueIndex("idx_changes_version").on(t.projectId, t.expectedVersion),
  ],
);
export const settings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
