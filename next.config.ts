import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    // AUDIT F7: build must be authoritative for type safety (CI runs tsc too,
    // but a red build locally should stop the ship).
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
