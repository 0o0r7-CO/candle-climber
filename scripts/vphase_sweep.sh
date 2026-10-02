#!/usr/bin/env bash
# V-PHASE sweep 2 — PROD multi-viewport evidence for the V-1 canvas fit + VD-5..7.
# States per viewport: ready panel -> running (ground-row check) -> death -> archive.
# Output: qa/visual-sweep/v2-<vp>-<state>.png + a JSON summary per viewport.
set -u
export AGENT_BROWSER_SESSION="vphase2"
OUT=/home/z/my-project/qa/visual-sweep
URL="https://candle-climber.vercel.app"
mkdir -p "$OUT"

sweep() { # $1 = tag, $2 = w, $3 = h
  local tag=$1 w=$2 h=$3
  echo "=== viewport $tag ${w}x${h}"
  agent-browser set viewport "$w" "$h"
  agent-browser open "$URL" >/dev/null
  sleep 9 # chart load + chips
  agent-browser screenshot "$OUT/v2-$tag-1-ready.png" >/dev/null
  cat <<'EOF' | agent-browser eval --stdin >/dev/null
(() => {
  const chips = document.querySelectorAll('.cc-char-chip');
  const v = document.querySelector('.cc-char-chip span.cc-char-name');
  return JSON.stringify({ chips: chips.length, firstName: v ? v.textContent : null });
})()
EOF
  # start a run — panel button if present, else tap stage
  cat <<'EOF' | agent-browser eval --stdin >/dev/null
(() => {
  const b = document.querySelector('.cc-btn-start');
  if (b) { b.click(); return 'start-clicked'; }
  const s = document.querySelector('.cc-stage');
  if (s) { s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); s.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }
  return 'stage-tap';
})()
EOF
  sleep 1.6
  agent-browser screenshot "$OUT/v2-$tag-2-running.png" >/dev/null
  # tap-jump a few times then wait for the death card (max ~40s)
  for i in $(seq 1 12); do
    DEAD=$(cat <<'EOF' | agent-browser eval --stdin
(() => {
  const s = document.querySelector('.cc-stage');
  if (s && document.querySelector('.cc-canvas') && !document.querySelector('.cc-death-num')) {
    s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    s.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  }
  return !!document.querySelector('.cc-death-num');
})()
EOF
)
    echo "  tap $i: death=$DEAD"
    [ "$DEAD" = "true" ] && break
    sleep 2.2
  done
  sleep 1
  agent-browser screenshot "$OUT/v2-$tag-3-death.png" >/dev/null
  # archive browser (VD-7 tags)
  cat <<'EOF' | agent-browser eval --stdin >/dev/null
(() => {
  const btns = Array.from(document.querySelectorAll('button')).find(x => /ARCHIVE/i.test(x.textContent || ''));
  if (btns) { btns.click(); return 'archive-opened'; }
  return 'no-archive-btn';
})()
EOF
  sleep 5
  agent-browser screenshot "$OUT/v2-$tag-4-archive.png" >/dev/null
  # HUD/geometry JSON: canvas rect + transform + chip label sample
  cat <<EOF | agent-browser eval --stdin > "$OUT/v2-$tag-geo.json"
(() => {
  const c = document.querySelector('.cc-canvas');
  const n = Array.from(document.querySelectorAll('.cc-char-name')).slice(0, 4).map(e => e.textContent);
  return JSON.stringify({ vw: innerWidth, vh: innerHeight, canvas: c ? c.getBoundingClientRect().toJSON() : null, names: n });
})()
EOF
  echo "--- $tag done"
}

sweep fhd 1920 937
sweep laptop 1280 800
sweep mobile 412 915
agent-browser close >/dev/null 2>&1
echo "SWEEP COMPLETE"
