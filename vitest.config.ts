import { defineConfig } from "vitest/config";

// Deliberately omits the Cloudflare/React plugins from vite.config.ts so unit
// tests (which never need the worker runtime or an `ssr` environment) run in
// plain Node with no network/framework coupling.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
