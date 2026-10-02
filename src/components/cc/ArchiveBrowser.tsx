"use client";

// H1 ARCHIVE browser (P2.2) — the era list + recent daily levels.
// Every row deep-links to real terrain: /?symbol=&date= (renderer=v2 carried
// through). Difficulty tags are COMPUTED from the actual clamped candles the
// server serves for that row (archiveTag), never hand-assigned — the archive
// stays documentary, not designed. Tags load lazily, one fetch at a time.
// Mounted only on user action (no SSR hydration surface).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ERAS,
  recentDailies,
  archiveTag,
  archiveHref,
  type DifficultyTag,
} from "@/game/cc/archive";
import { utcDateStr } from "@/game/cc/rng";
import type { CandleData } from "@/game/cc/types";

interface Row {
  key: string;
  symbol: string;
  date: string;
  name: string;
  blurb?: string;
  era: boolean;
}

const TAG_CLASS: Record<DifficultyTag, string> = {
  CALM: "cc-arch-tag calm",
  ROCKY: "cc-arch-tag rocky",
  BRUTAL: "cc-arch-tag brutal",
  LEGENDARY: "cc-arch-tag legendary",
};

export default function ArchiveBrowser({ onClose }: { onClose: () => void }) {
  // rows are pure derivations of (ERAS, today) — computed once per mount
  const { eras, dailies } = useMemo(() => {
    const today = utcDateStr();
    return {
      eras: ERAS.map((e) => ({
        key: `${e.symbol}|${e.date}`,
        symbol: e.symbol,
        date: e.date,
        name: e.name,
        blurb: e.blurb,
        era: true,
      })),
      dailies: recentDailies(today, 10).map((d) => ({
        key: `${d.symbol}|${d.date}`,
        symbol: d.symbol,
        date: d.date,
        name: d.date,
        era: false,
      })),
      today,
    };
  }, []);

  const [tags, setTags] = useState<Record<string, DifficultyTag>>({});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const rows = [...eras, ...dailies];
    // lazy sequential tag loader — one small fetch per row, abortable
    (async () => {
      for (const r of rows) {
        if (!alive.current) return;
        try {
          const res = await fetch(`/api/candles?symbol=${r.symbol}&date=${r.date}`);
          const d = (await res.json()) as CandleData;
          if (!alive.current) return;
          if (d?.candles?.length) {
            setTags((prev) => ({ ...prev, [r.key]: archiveTag(d.candles) }));
          }
        } catch {
          /* row keeps its placeholder — offline is fine, deep links still work */
        }
      }
    })();
    return () => {
      alive.current = false;
    };
  }, []);

  const today = utcDateStr();

  const renderRow = (r: Row) => {
    const tag = tags[r.key];
    const href = archiveHref(
      { symbol: r.symbol, date: r.date, renderer: new URLSearchParams(window.location.search).get("renderer") ?? undefined },
      today,
    );
    return (
      <a key={r.key} className={`cc-arch-row${r.era ? " era" : ""}`} href={href}>
        <span className="cc-arch-main">
          <span className="cc-arch-name">{r.name}</span>
          {r.blurb && <span className="cc-arch-blurb">{r.blurb}</span>}
        </span>
        <span className="cc-arch-meta">
          <span className="cc-arch-sym">{r.symbol}</span>
          <span className="cc-arch-date">{r.date}</span>
          <span
            className={tag ? TAG_CLASS[tag] : "cc-arch-tag"}
            title={tag ? undefined : "difficulty loads as rows are scanned"}
          >{tag ?? "· · ·"}</span>
        </span>
      </a>
    );
  };

  return (
    <div className="cc-overlay cc-arch-overlay">
      <div className="cc-panel cc-arch-panel">
        <div className="cc-arch-head">
          <h2 className="cc-arch-title">THE ARCHIVE</h2>
          <button className="cc-arch-close" onClick={onClose} aria-label="Close archive">×</button>
        </div>
        <p className="cc-arch-lede">our levels are documentary, not designed. every past day is real terrain — era levels end on the monday their story-week closed, so the famous candle is the one you finish on.</p>
        <div className="cc-arch-section">HISTORIC ERAS</div>
        <div className="cc-arch-list">{eras.map(renderRow)}</div>
        <div className="cc-arch-section">RECENT DAILIES</div>
        <div className="cc-arch-list">{dailies.map(renderRow)}</div>
        <p className="cc-arch-note">archive runs are practice — scores are not recorded. back to the top of the mountain: <a className="cc-arch-today" href="/">TODAY</a></p>
      </div>
    </div>
  );
}
