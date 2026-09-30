// Client-side Sentry init (Next.js 15+ / Turbopack entry — replaces sentry.client.config.ts).
import * as Sentry from "@sentry/nextjs";

const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://059663a5fc68fe45cbcf425ebaaea26e@o4512112704028672.ingest.us.sentry.io/4512177773608960";

Sentry.init({
  dsn: DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || (process.env.NODE_ENV === "production" ? "production" : "development"),
  // Performance: 10% of navigations/transactions — enough signal for a canvas game, low noise.
  tracesSampleRate: 0.1,
  // Session Replay: full replay ONLY when an error occurs (canvas itself is not recorded,
  // but the DOM UI — panels, leaderboard, death card — is). Zero session-weight otherwise.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  // v11 privacy group — equivalent of the old sendDefaultPii:false
  dataCollection: { userInfo: false, cookies: false },
});

// App Router navigation instrumentation (required by @sentry/nextjs v11)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
