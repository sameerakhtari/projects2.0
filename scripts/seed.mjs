import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

await mkdir(".astra-local", { recursive: true });
await build({
  entryPoints: ["src/content/repository.ts", "src/content/model.ts"],
  outdir: ".astra-local/seed-code",
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  packages: "external",
});
const { revisionStatements } =
  await import("../.astra-local/seed-code/repository.mjs");
const { projectSchema } = await import("../.astra-local/seed-code/model.mjs");
const projects = JSON.parse(
  await readFile("src/content/seed.json", "utf8"),
).map((p) => projectSchema.parse(p));
const remote = process.argv.includes("--remote");
const configIndex = process.argv.indexOf("--config");
const config =
  configIndex >= 0 ? process.argv[configIndex + 1] : "wrangler.jsonc";
if (remote && config === "wrangler.jsonc")
  throw new Error(
    "Remote seeding requires --config pointing to your private production configuration.",
  );
const command = [
  "node_modules/wrangler/bin/wrangler.js",
  "d1",
  "execute",
  "DB",
  remote ? "--remote" : "--local",
  "--config",
  config,
];
const result = execFileSync(
  process.execPath,
  [...command, "--command", "SELECT count(*) AS count FROM projects", "--json"],
  { encoding: "utf8" },
);
const parsed = JSON.parse(result);
if (parsed[0].results[0].count !== 0)
  throw new Error(
    "Refusing to seed a non-empty archive. Existing content is never overwritten.",
  );
const quote = (value) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
const statements = [];
const db = {
  prepare(sql) {
    return {
      bind(...values) {
        return { sql, values };
      },
    };
  },
};
const ids = new Map(projects.map((p) => [p.slug, crypto.randomUUID()]));
const now = new Date().toISOString();
for (const p of projects)
  statements.push({
    sql: "INSERT INTO projects (id,slug,version,created_at,updated_at) VALUES (?,?,1,?,?)",
    values: [ids.get(p.slug), p.slug, now, now],
  });
for (const p of projects) {
  const id = ids.get(p.slug),
    revision = crypto.randomUUID();
  statements.push(...revisionStatements(db, id, revision, p, ids, now));
  statements.push({
    sql: "UPDATE projects SET draft_revision_id=? WHERE id=?",
    values: [revision, id],
  });
}
// Publish only after all records and relationships have been imported successfully.
statements.push({
  sql: "UPDATE projects SET published_revision_id=draft_revision_id,published_at=? WHERE deleted_at IS NULL",
  values: [now],
});
statements.push({
  sql: "INSERT INTO site_settings (key,value) VALUES (?,?)",
  values: ["seed_version", "1"],
});
statements.push({
  sql: "INSERT INTO audit_log (id,actor,action,project_id,detail,created_at) VALUES (?,?,?,?,?,?)",
  values: [
    crypto.randomUUID(),
    "cli-seed",
    "content.seeded",
    null,
    `${projects.length} curated public records`,
    now,
  ],
});
const sql = statements
  .map((s) => {
    let i = 0;
    return s.sql.replace(/\?/g, () => quote(s.values[i++])) + ";";
  })
  .join("\n");
const file = resolve(".astra-local/seed.sql");
await writeFile(file, sql);
const seeded = JSON.parse(
  execFileSync(process.execPath, [...command, "--file", file, "--json"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }),
);
if (seeded.some((r) => r.success === false))
  throw new Error("Import failed. Inspect the database before retrying.");
console.log(`Imported ${projects.length} reviewed project records.`);
