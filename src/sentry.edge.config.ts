import * as Sentry from "@sentry/nextjs";

const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://059663a5fc68fe45cbcf425ebaaea26e@o4512112704028672.ingest.us.sentry.io/4512177773608960";

Sentry.init({
  dsn: DSN,
  environment: process.env.VERCEL_ENV || (process.env.NODE_ENV === "production" ? "production" : "development"),
  tracesSampleRate: 0.1,
  // v11 privacy group — equivalent of the old sendDefaultPii:false
  dataCollection: { userInfo: false, cookies: false },
});
