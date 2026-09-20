import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const file = resolve("wrangler.production.json");
const source = await readFile(file, "utf8").catch(() => {
  throw new Error(
    "Complete the private wrangler.production.json using docs/DEPLOYMENT.md.",
  );
});
const config = JSON.parse(source);
function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}
requireValue(
  !/REPLACE_|GENERATE-|\.example\.(?:com|org)|00000000-0000/.test(source),
  "Replace production placeholders.",
);
requireValue(
  config.vars?.ENVIRONMENT === "production",
  "Production must not use development mode.",
);
const origin = new URL(config.vars.SITE_ORIGIN);
requireValue(
  origin.protocol === "https:" && origin.origin === config.vars.SITE_ORIGIN,
  "Use an exact HTTPS SITE_ORIGIN.",
);
requireValue(
  config.workers_dev === false && config.preview_urls === false,
  "Disable alternate Worker URLs.",
);
requireValue(
  config.assets?.run_worker_first === true,
  "Worker must gate assets.",
);
requireValue(
  /^[a-f0-9]{32}$/.test(config.account_id),
  "Configure the account ID.",
);
requireValue(
  config.d1_databases?.some(
    (d) => d.binding === "DB" && /^[a-f0-9-]{36}$/.test(d.database_id),
  ),
  "Configure DB.",
);
requireValue(
  config.r2_buckets?.some((b) => b.binding === "BUCKET" && b.bucket_name),
  "Configure private BUCKET.",
);
requireValue(
  config.ratelimits?.some(
    (r) =>
      r.name === "ADMIN_RATE_LIMITER" &&
      /^[1-9]\d*$/.test(r.namespace_id) &&
      r.simple?.period === 60 &&
      r.simple.limit > 0,
  ),
  "Configure owner rate binding.",
);
requireValue(
  /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
    config.vars.ACCESS_ISSUER,
  ) && config.vars.ACCESS_AUDIENCE?.length >= 16,
  "Configure Access issuer/audience.",
);
requireValue(
  !config.vars.CSRF_SECRET && !config.vars.ACCESS_OWNER_SUBJECTS,
  "Owner and CSRF values belong in platform secrets.",
);
requireValue(
  config.routes?.some((r) => r.custom_domain && r.pattern === origin.hostname),
  "Custom domain must match origin.",
);
const action = process.argv[2];
requireValue(["build", "deploy"].includes(action), "Expected build or deploy.");
execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH: file,
    CLOUDFLARE_CF_FETCH_ENABLED: "false",
    WRANGLER_SEND_METRICS: "false",
  },
});
const built = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
requireValue(
  built.vars?.ENVIRONMENT === "production" &&
    built.vars.SITE_ORIGIN === origin.origin &&
    built.account_id === config.account_id,
  "Build lost production configuration.",
);
if (action === "deploy")
  execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "deploy",
      "--config",
      "dist/server/wrangler.json",
    ],
    { stdio: "inherit" },
  );
else console.log("Production build prepared; no deployment performed.");
