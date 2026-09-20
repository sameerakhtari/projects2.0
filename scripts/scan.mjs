import { execFileSync } from "node:child_process";
import { readFile, stat, readdir } from "node:fs/promises";
const paths = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
const forbidden =
  /(^|\/)(?:node_modules|dist|build|\.next|\.wrangler|\.astra-local|\.sites-runtime|coverage|test-results|playwright-report)(\/|$)|(^|\/)(?:\.env(?:\..*)?|\.dev.vars(?:\..*)?|wrangler\.production\.json)$|\.(?:zip|sqlite3?|db|log|tsbuildinfo)$|^\.github\/workflows\//;
const patterns = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
];
const problems = [];
for (const path of paths) {
  if (path !== ".env.example" && forbidden.test(path))
    problems.push(`${path}: generated/private file`);
  const info = await stat(path);
  if (!info.isFile()) continue;
  if (info.size > 512 * 1024) problems.push(`${path}: source exceeds 512 KB`);
  const text = await readFile(path, "utf8");
  if (patterns.some((p) => p.test(text)))
    problems.push(`${path}: possible credential (value withheld)`);
  if (path === "src/content/seed.json") {
    if (
      /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/.test(
        text,
      )
    )
      problems.push(`${path}: private address`);
    if (JSON.parse(text).some((p) => p.privateNotes))
      problems.push(`${path}: private seed notes`);
  }
}
async function inspect(directory) {
  for (const e of await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  )) {
    const p = `${directory}/${e.name}`;
    if (e.isDirectory()) await inspect(p);
    else if (e.name.endsWith(".map")) problems.push(`${p}: source map`);
  }
}
await inspect("dist");
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exitCode = 1;
} else
  console.log(
    `Source/privacy scan passed for ${paths.length} files. Manual review remains required.`,
  );
