import { z } from "zod";
export const statuses = [
  "EVOLVING",
  "BUILT",
  "IN PROGRESS",
  "EXPERIMENT",
  "HISTORICAL",
  "ARCHIVED",
] as const;
export const domains = [
  "Infrastructure",
  "Networking",
  "Automation",
  "Observability",
  "Security",
  "Embedded & IoT",
  "Software",
] as const;
export const kinds = ["HARDWARE", "SOFTWARE", "HYBRID"] as const;
export const relationTypes = [
  "EVOLVED_FROM",
  "DEPENDS_ON",
  "INSPIRED",
  "REPLACED",
  "EXTENDS",
  "RELATED_TO",
  "EXPERIMENT_FOR",
] as const;
export const relationLabels: Record<(typeof relationTypes)[number], string> = {
  EVOLVED_FROM: "evolved from",
  DEPENDS_ON: "depends on",
  INSPIRED: "inspired",
  REPLACED: "replaced",
  EXTENDS: "extends",
  RELATED_TO: "related to",
  EXPERIMENT_FOR: "experiment for",
};
const short = z.string().trim().min(1).max(160);
const key = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
export const slugSchema = key.refine(
  (v) => !["new", "admin", "api", "media"].includes(v),
  "Choose a different slug.",
);
export const safeUrl = z
  .string()
  .max(2048)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !/[\x00-\x20]/.test(v)
    );
  }, "Use an HTTPS URL without embedded credentials.");
export const dateSchema = z.string().refine((v) => {
  if (/^\d{4}$/.test(v)) return +v >= 1990 && +v <= 2100;
  if (/^\d{4}-\d{2}$/.test(v))
    return (
      +v.slice(5) >= 1 &&
      +v.slice(5) <= 12 &&
      +v.slice(0, 4) >= 1990 &&
      +v.slice(0, 4) <= 2100
    );
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}, "Use YYYY, YYYY-MM or a valid YYYY-MM-DD date.");
export const projectSchema = z
  .object({
    slug: slugSchema,
    title: short,
    subtitle: z.string().trim().max(180),
    summary: z.string().trim().min(20).max(650),
    status: z.enum(statuses),
    domain: z.enum(domains),
    kind: z.enum(kinds),
    timeframe: short,
    startYear: z.number().int().min(1990).max(2100).nullable(),
    endYear: z.number().int().min(1990).max(2100).nullable(),
    featured: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999),
    nextIteration: z.string().trim().max(4000),
    privateNotes: z.string().max(8000).default(""),
    technologies: z
      .array(z.string().trim().min(1).max(60))
      .max(30)
      .refine(
        (v) => new Set(v.map((s) => s.toLowerCase())).size === v.length,
        "Remove duplicate technologies.",
      ),
    sections: z
      .array(
        z
          .object({ heading: short, body: z.string().trim().min(1).max(16000) })
          .strict(),
      )
      .max(20),
    updates: z
      .array(
        z
          .object({
            date: dateSchema,
            title: short,
            body: z.string().max(6000),
            kind: z.enum(["MILESTONE", "NOTE", "EXPERIMENT", "PLANNED"]),
          })
          .strict(),
      )
      .max(100),
    links: z.array(z.object({ label: short, url: safeUrl }).strict()).max(20),
    relationships: z
      .array(
        z
          .object({
            target: key,
            type: z.enum(relationTypes),
            note: z.string().trim().max(400),
          })
          .strict(),
      )
      .max(20),
    architecture: z
      .object({
        nodes: z
          .array(
            z
              .object({
                key,
                label: z.string().trim().min(1).max(40),
                detail: z.string().max(100),
                column: z.number().int().min(0).max(3),
              })
              .strict(),
          )
          .max(16),
        edges: z
          .array(
            z
              .object({ from: key, to: key, label: z.string().max(80) })
              .strict(),
          )
          .max(24),
      })
      .strict(),
    media: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            alt: z.string().trim().min(1).max(400),
            caption: z.string().max(1000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.startYear && p.endYear && p.endYear < p.startYear)
      ctx.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "End year must follow start year.",
      });
    const ids = new Set(p.architecture.nodes.map((n) => n.key));
    if (ids.size !== p.architecture.nodes.length)
      ctx.addIssue({
        code: "custom",
        path: ["architecture"],
        message: "Node keys must be unique.",
      });
    if (
      p.architecture.edges.some(
        (e) => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["architecture"],
        message: "Each connection must join two existing, different nodes.",
      });
    if (p.relationships.some((r) => r.target === p.slug))
      ctx.addIssue({
        code: "custom",
        path: ["relationships"],
        message: "A project cannot relate to itself.",
      });
    if (
      new Set(p.relationships.map((r) => `${r.type}:${r.target}`)).size !==
      p.relationships.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["relationships"],
        message: "Remove duplicate relationships.",
      });
    if (new Set(p.media.map((m) => m.id)).size !== p.media.length)
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Remove duplicate images.",
      });
  });
export type ProjectInput = z.infer<typeof projectSchema>;
export type PublicProject = Omit<ProjectInput, "privateNotes" | "media"> & {
  updatedAt: string;
  publishedAt: string;
  media: (ProjectInput["media"][number] & { width: number; height: number })[];
};
export type AdminProject = ProjectInput & {
  id: string;
  version: number;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
  updatedAt: string;
  publishedAt: string | null;
};
export const saveSchema = z
  .object({ version: z.number().int().min(0), project: projectSchema })
  .strict();
export const commandSchema = z
  .object({
    version: z.number().int().min(0),
    confirmation: z.string().max(80).optional(),
  })
  .strict();

export function matches(p: PublicProject, query: URLSearchParams): boolean {
  const q = (query.get("q") || "").trim().toLowerCase().slice(0, 200);
  const haystack = [
    p.title,
    p.subtitle,
    p.summary,
    ...p.technologies,
    p.domain,
    p.status,
  ]
    .join(" ")
    .toLowerCase();
  return (
    (!q || q.split(/\s+/).every((word) => haystack.includes(word))) &&
    (!query.get("domain") || p.domain === query.get("domain")) &&
    (!query.get("status") ||
      (query.get("status") === "active"
        ? ["EVOLVING", "IN PROGRESS"].includes(p.status)
        : p.status === query.get("status"))) &&
    (!query.get("kind") || p.kind === query.get("kind")) &&
    (!query.get("technology") ||
      p.technologies.some(
        (t) => t.toLowerCase() === query.get("technology")?.toLowerCase(),
      )) &&
    (!query.get("year") ||
      (p.startYear !== null &&
        +query.get("year")! >= p.startYear &&
        +query.get("year")! <= (p.endYear ?? new Date().getUTCFullYear())))
  );
}
