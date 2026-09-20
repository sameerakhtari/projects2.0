import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
process.env.WRANGLER_SEND_METRICS ??= "false";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "server" },
      inspectorPort: false,
      remoteBindings: false,
    }),
  ],
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: { sourcemap: false },
});
