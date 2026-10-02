// Shareable-code generation (P7.3 duels) — server-side, crypto-random.
// Alphabet excludes look-alikes (0/O, 1/I/L) so a code read off a death card
// or typed from a screenshot survives human transcription. Used ONLY by the
// duel store (the code is assigned at creation, never client-chosen).
import { randomBytes } from "node:crypto";
import { DUEL_CODE_ALPHABET } from "@/game/cc/duel";

export function createRandomCode(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += DUEL_CODE_ALPHABET[bytes[i] % DUEL_CODE_ALPHABET.length];
  }
  return out;
}
