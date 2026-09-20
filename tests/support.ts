import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import type { Bindings } from "../src/types";
import { projectSchema, type ProjectInput } from "../src/content/model";

export function sqliteD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  class Statement {
    constructor(
      readonly sql: string,
      readonly values: (string | number | null)[] = [],
    ) {}
    bind(...values: (string | number | null)[]) {
      return new Statement(this.sql, values);
    }
    runSync() {
      const stmt = sqlite.prepare(this.sql);
      let results: unknown[] = [];
      let changes = 0;
      if (stmt.columns().length) results = stmt.all(...this.values);
      else changes = Number(stmt.run(...this.values).changes);
      return {
        results,
        success: true,
        meta: {
          changes,
          duration: 0,
          last_row_id: 0,
          changed_db: changes > 0,
          size_after: 0,
          rows_read: results.length,
          rows_written: changes,
        },
      };
    }
    async all() {
      return this.runSync();
    }
    async run() {
      return this.runSync();
    }
    async first(column?: string) {
      const result = this.runSync().results[0] as
        Record<string, unknown> | undefined;
      return result ? (column ? result[column] : result) : null;
    }
  }
  const db = {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((s) => s.runSync());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return {
    db: db as unknown as D1Database,
    sqlite,
    close: () => sqlite.close(),
  };
}
export function bucket() {
  const items = new Map<string, Uint8Array>();
  return {
    items,
    binding: {
      put: async (key: string, value: Uint8Array) => {
        items.set(key, new Uint8Array(value));
        return {};
      },
      delete: async (key: string) => {
        items.delete(key);
      },
      get: async (key: string) => {
        const bytes = items.get(key);
        return bytes
          ? { body: new Blob([new Uint8Array(bytes)]).stream() }
          : null;
      },
    } as unknown as R2Bucket,
  };
}
export function environment(db: D1Database): Bindings {
  return {
    DB: db,
    BUCKET: bucket().binding,
    SITE_ORIGIN: "https://archive.example.com",
    ENVIRONMENT: "production",
    ACCESS_ISSUER: "https://test-team.cloudflareaccess.com",
    ACCESS_AUDIENCE: "test-application-audience",
    ACCESS_OWNER_SUBJECTS: "test-owner-subject",
    CSRF_SECRET: crypto.randomUUID() + crypto.randomUUID(),
    ADMIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
}
export function sample(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return projectSchema.parse({
    slug: "test-project",
    title: "A test project",
    subtitle: "Integration fixture",
    summary: "A meaningful fixture for publication and request security tests.",
    status: "EXPERIMENT",
    domain: "Software",
    kind: "SOFTWARE",
    timeframe: "2026",
    startYear: 2026,
    endYear: null,
    featured: false,
    sortOrder: 1,
    nextIteration: "Measure the result.",
    privateNotes: "PRIVATE-NOTE-SENTINEL",
    technologies: ["TypeScript"],
    sections: [{ heading: "Purpose", body: "A **small** experiment." }],
    updates: [],
    links: [],
    relationships: [],
    architecture: { nodes: [], edges: [] },
    media: [],
    ...overrides,
  });
}
function crc(data: Uint8Array) {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  out.write(type, 4);
  out.set(data, 8);
  out.writeUInt32BE(crc(out.subarray(4, -4)), out.length - 4);
  return out;
}
export function png(extra = false) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      ...(extra
        ? [chunk("tEXt", Buffer.from("Comment\0private metadata"))]
        : []),
      chunk(
        "IDAT",
        deflateSync(Buffer.from([0, 255, 0, 0, 255, 0, 255, 0, 255])),
      ),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
