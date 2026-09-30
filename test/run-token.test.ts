/// <reference types="bun-types" />
// W5 "integrity of the climb" — run-token contract tests (bun test, zero deps).
// Pins the HMAC attestation contract from W1: sign/verify roundtrip, tamper
// rejection, secret sensitivity, the UTC date-window boundaries, and the strict
// payload shape. Pure lib only — no route imports, no network, no sleeps.
//
// process.env.RUN_TOKEN_SECRET is mocked per case: getRunTokenSecret() prefers
// it over MONGODB_URI/DATABASE_URL/{"cc-local-dev-secret"}, so setting it makes
// sign+verify deterministic regardless of ambient .env files.
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createHash, createHmac } from "node:crypto";
import {
  signRunToken,
  verifyRunToken,
  isTokenStale,
  getRunTokenSecret,
  type RunTokenPayload,
} from "@/lib/run-token";

const ENV_KEY = "RUN_TOKEN_SECRET";
const SECRET_A = "w5-test-secret-a";
const SECRET_B = "w5-test-secret-b";
let savedSecret: string | undefined;

const CANDLE_JSON = JSON.stringify([
  { t: 1657670400000, o: 248.4, h: 250.1, l: 247.6, c: 249.9 },
  { t: 1658275200000, o: 249.9, h: 252.0, l: 248.1, c: 251.3 },
]);
const SYMBOL = "SOLUSDT";
const DATE = "2026-09-30";
const COUNT = 220;

/** Sign an ARBITRARY payload object with a given secret (shape-violation helper). */
function craftToken(payload: Record<string, unknown>, secret: string): string {
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(p).digest("base64url");
  return `${p}.${sig}`;
}

/** Flip one character of a string (keeps base64url charset valid). */
function flipChar(s: string): string {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "A") return s.slice(0, i) + "A" + s.slice(i + 1);
  }
  return "B" + s.slice(1);
}

beforeAll(() => {
  savedSecret = process.env[ENV_KEY];
  process.env[ENV_KEY] = SECRET_A;
});

afterAll(() => {
  if (savedSecret === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedSecret;
});

describe("W5 run-token contract", () => {
  test("roundtrip: sign -> verify returns the exact payload fields", () => {
    const tok = signRunToken(SYMBOL, DATE, COUNT, CANDLE_JSON);
    const verified = verifyRunToken(tok);
    expect(verified).not.toBeNull();
    const p = verified as RunTokenPayload;
    expect(p.symbol).toBe(SYMBOL);
    expect(p.date).toBe(DATE);
    expect(p.count).toBe(COUNT);
    // h is sha256(candleJson).slice(0, 16) — the terrain fingerprint
    const expectedH = createHash("sha256").update(CANDLE_JSON).digest("hex").slice(0, 16);
    expect(p.h).toBe(expectedH);
    expect(p.h).toMatch(/^[0-9a-f]{16}$/);
    // deterministic: same inputs -> same token (no iat by design)
    expect(signRunToken(SYMBOL, DATE, COUNT, CANDLE_JSON)).toBe(tok);
  });

  test("tampered payload (one char flipped) -> null", () => {
    const tok = signRunToken(SYMBOL, DATE, COUNT, CANDLE_JSON);
    const [payload, sig] = tok.split(".");
    const tampered = `${flipChar(payload)}.${sig}`;
    expect(tampered).not.toBe(tok);
    expect(verifyRunToken(tampered)).toBeNull();
    // forged variant: payload rewritten, original signature kept
    const forged = craftToken({ ...{ symbol: "XRPUSDT", date: DATE, count: COUNT, h: "0123456789abcdef" } }, SECRET_A);
    expect(verifyRunToken(forged)).not.toBeNull(); // self-consistent forge verifies...
    // ...but a forged payload under the ORIGINAL signature is rejected
    const forgedPayload = Buffer.from(
      JSON.stringify({ symbol: "XRPUSDT", date: DATE, count: COUNT, h: "0123456789abcdef" }),
    ).toString("base64url");
    expect(verifyRunToken(`${forgedPayload}.${sig}`)).toBeNull();
  });

  test("signed with secret A, verified with secret B -> null", () => {
    const tok = signRunToken(SYMBOL, DATE, COUNT, CANDLE_JSON);
    process.env[ENV_KEY] = SECRET_B; // re-key the verifier
    expect(verifyRunToken(tok)).toBeNull();
    process.env[ENV_KEY] = SECRET_A; // restore for later cases
    expect(verifyRunToken(tok)).not.toBeNull();
  });

  test("isTokenStale boundaries: today/yesterday valid, day-before-yesterday stale", () => {
    const now = new Date("2026-10-02T15:00:00Z");
    expect(isTokenStale("2026-10-02", now)).toBe(false); // today
    expect(isTokenStale("2026-10-01", now)).toBe(false); // yesterday (date+1 still valid)
    expect(isTokenStale("2026-09-30", now)).toBe(true); // day-before-yesterday
    // pure date-string compare: time-of-day of `now` must not matter
    expect(isTokenStale("2026-10-01", new Date("2026-10-02T00:00:00Z"))).toBe(false);
    expect(isTokenStale("2026-10-01", new Date("2026-10-02T23:59:59Z"))).toBe(false);
  });

  test("malformed inputs -> null (non-string, wrong part count, bad base64url)", () => {
    // non-string tokens
    expect(verifyRunToken(null)).toBeNull();
    expect(verifyRunToken(undefined)).toBeNull();
    expect(verifyRunToken(42)).toBeNull();
    expect(verifyRunToken({ symbol: SYMBOL })).toBeNull();
    expect(verifyRunToken(["a.b"])).toBeNull();
    // wrong part count / empty
    expect(verifyRunToken("")).toBeNull();
    expect(verifyRunToken("justonepart")).toBeNull();
    expect(verifyRunToken("a.b.c")).toBeNull();
    // signature that is not valid base64url for a 32-byte HMAC
    const tok = signRunToken(SYMBOL, DATE, COUNT, CANDLE_JSON);
    expect(verifyRunToken(`${tok.split(".")[0]}.!!!not-base64url!!!`)).toBeNull();
    // payload that does not decode to JSON (signed correctly, still null)
    const junkPayload = Buffer.from("not json at all").toString("base64url");
    const junkSig = createHmac("sha256", getRunTokenSecret()).update(junkPayload).digest("base64url");
    expect(verifyRunToken(`${junkPayload}.${junkSig}`)).toBeNull();
    // JSON that is not an object
    const numPayload = Buffer.from("42").toString("base64url");
    const numSig = createHmac("sha256", getRunTokenSecret()).update(numPayload).digest("base64url");
    expect(verifyRunToken(`${numPayload}.${numSig}`)).toBeNull();
  });

  test("payload shape violations -> null (date/count/h/symbol), even when signed", () => {
    const s = getRunTokenSecret();
    const base = { symbol: SYMBOL, date: DATE, count: COUNT, h: "0123456789abcdef" };
    const expectNull = (p: Record<string, unknown>) => expect(verifyRunToken(craftToken(p, s))).toBeNull();

    expectNull({ ...base, date: "2026/09/30" }); // bad date format
    expectNull({ ...base, date: "2026-9-30" }); // no zero padding
    expectNull({ ...base, date: 20260930 }); // wrong type
    expectNull({ ...base, count: 0 }); // zero candles
    expectNull({ ...base, count: 999999 }); // beyond the 10k sanity bound
    expectNull({ ...base, count: 2.5 }); // non-integer
    expectNull({ ...base, count: "220" }); // wrong type
    expectNull({ ...base, h: "0123456789abcdeg" }); // g is not hex
    expectNull({ ...base, h: "0123456789" }); // not 16 chars
    expectNull({ ...base, h: 123 }); // wrong type
    expectNull({ ...base, symbol: "" }); // empty symbol
    expectNull({ ...base, symbol: "THIRTEENCHARS" }); // 13 chars > 12 cap
    expectNull({ ...base, symbol: 7 }); // wrong type
    // sanity: the exact boundary is accepted (12-char symbol, count 10000)
    const ok = verifyRunToken(craftToken({ ...base, symbol: "TWELVECHARSX", count: 10000 }, s));
    expect(ok).not.toBeNull();
  });
});
