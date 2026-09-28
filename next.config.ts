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

export default nextConfig;
