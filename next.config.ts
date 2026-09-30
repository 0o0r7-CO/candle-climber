import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output is for self-hosted/sandbox production runs (`bun run
  // build:standalone` + `bun run start`). On Vercel the platform runtime is
  // used instead — keep the default output there.
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    // AUDIT F7: build must be authoritative for type safety (CI runs tsc too,
    // but a red build locally should stop the ship).
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default withSentryConfig(nextConfig, {
  // Sentry CI wiring — org/project created 2026-10-01 (docs/INFRASTRUCTURE.md §Sentry).
  // authToken comes from SENTRY_AUTH_TOKEN (local .env / Vercel env); without it the
  // build still passes and only skips source-map upload with a warning.
  org: "james-thomas-st",
  project: "candle-climber",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: true,
  widenClientFileUpload: true,
});
