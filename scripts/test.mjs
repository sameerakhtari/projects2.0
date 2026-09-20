import { build } from "esbuild";
import { mkdir, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".astra-local/tests", { recursive: true });
const entries = (await readdir("tests"))
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => `tests/${f}`);
await build({
  entryPoints: entries,
  outdir: ".astra-local/tests",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outExtension: { ".js": ".mjs" },
  jsx: "automatic",
  jsxImportSource: "hono/jsx",
});
const result = spawnSync(
  process.execPath,
  [
    "--test",
    ...entries.map(
      (f) => `.astra-local/tests/${f.split("/").pop().replace(".ts", ".mjs")}`,
    ),
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
