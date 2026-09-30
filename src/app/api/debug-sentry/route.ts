// Debug/health probe for the Sentry pipeline — GET-only, no state, no secrets.
//   GET /api/debug-sentry         → { ok: true, hint }
//   GET /api/debug-sentry?go=1    → sends one info-level event to Sentry and
//                                   returns its event_id (verifiable in the UI).
// Used to prove end-to-end ingest from any deploy (local + preview + production).
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("go") !== "1") {
    return NextResponse.json({
      ok: true,
      hint: "append ?go=1 to send a test event to Sentry",
    });
  }

  const eventId = Sentry.captureMessage(
    "candle-climber debug ping (api route)",
    "info",
  );
  await Sentry.flush(2500);

  return NextResponse.json({ ok: true, eventId });
}
