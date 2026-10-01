// WebAudio synth — zero-asset sound design
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  // resume() rejects (NotAllowedError) when called outside a user-gesture
  // window — e.g. setTimeout-deferred sfx (milestone/victory). A bare `void`
  // leaves the rejection unhandled (CANDLE-CLIMBER-2: DOMException carries
  // exactly the keys code/message/stack). Swallow: sound is best-effort.
  if (ctx?.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() { ac(); }

export function setMuted(m: boolean) {
  if (ctx) ctx.suspend().catch(() => {});
  if (!m) ctx?.resume().catch(() => {});
}

function blip(freq0: number, freq1: number, dur: number, type: OscillatorType, vol = 0.12) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq0, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.02);
}

function noise(dur: number, vol = 0.14) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  jump: () => blip(300, 540, 0.12, "square", 0.08),
  land: () => blip(180, 140, 0.06, "triangle", 0.07),
  crumble: () => noise(0.22, 0.12),
  death: () => { blip(320, 60, 0.5, "sawtooth", 0.12); noise(0.3, 0.1); },
  milestone: () => { blip(520, 780, 0.1, "square", 0.08); setTimeout(() => blip(660, 990, 0.12, "square", 0.08), 90); },
  // W4: summit graduation fanfare (summit land) — short rising arpeggio
  victory: () => {
    blip(523, 523, 0.09, "square", 0.09);
    setTimeout(() => blip(659, 659, 0.09, "square", 0.09), 100);
    setTimeout(() => blip(784, 784, 0.09, "square", 0.09), 200);
    setTimeout(() => blip(1046, 1568, 0.22, "square", 0.09), 300);
  },
};
