// Sentry bootstrap for server (node) + edge runtimes — Next.js 16 instrumentation hook.
// Client-side init lives in src/instrumentation-client.ts (Turbopack-compatible entry).
// Token/org/project wiring is documented in docs/INFRASTRUCTURE.md §Sentry.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture server request errors across route handlers / server components (Next 15+ contract).
export const onRequestError = Sentry.captureRequestError;
