"use client";

// App Router global error boundary — last-resort catch that also reports to Sentry.
// (Canvas/game errors are additionally captured by instrumentation-client.ts.)
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0e14",
          color: "#e8e3d5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 13, letterSpacing: 2, color: "#c8a24a", margin: "0 0 8px" }}>
            SUMMIT LOST
          </p>
          <h1 style={{ fontSize: 20, margin: "0 0 12px", fontWeight: 600 }}>
            Something broke the climb.
          </h1>
          <p style={{ fontSize: 13, color: "#8a8f9a", margin: "0 0 20px" }}>
            The error was reported automatically{error.digest ? ` (ref: ${error.digest})` : ""}.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 22px",
              borderRadius: 8,
              border: "1px solid #c8a24a",
              background: "transparent",
              color: "#c8a24a",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
