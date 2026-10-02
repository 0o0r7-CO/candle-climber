// characters.test.ts — P3.12/P3.14 registry purity + manifest safety.
// The registry is PURE DATA: no side effects, no I/O at import time (W5 rule).
// Sprite assets live in public/cc/chars/<id>/ — validated here from disk.
import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { CHARACTERS, DEFAULT_CHAR_ID, CHAR_KEY, getChar, isValidCharId, rosterList } from "../src/game/cc/characters";

describe("P3.12 character registry", () => {
  test("roster size: 15 entries (14 sprites + procedural classic)", () => {
    expect(CHARACTERS.length).toBe(15);
  });

  test("ids unique + classic default first", () => {
    const ids = CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CHARACTERS[0].id).toBe(DEFAULT_CHAR_ID);
  });

  test("classic default is the ONLY procedural entry (sheet=null, no frames)", () => {
    const procedural = CHARACTERS.filter((c) => c.sheet === null);
    expect(procedural.length).toBe(1);
    expect(procedural[0].id).toBe("default");
    expect(procedural[0].frames.length).toBe(0);
  });

  test("every sprite entry: 4 frames, 96px tall, positive widths, sheet on disk", () => {
    for (const c of CHARACTERS) {
      if (c.sheet === null) continue;
      expect(c.frames.length).toBe(4);
      expect(c.frameH).toBe(96);
      for (const f of c.frames) {
        expect(f.w).toBeGreaterThan(10);
        expect(f.h).toBe(96);
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
      }
      const p = `public${c.sheet}`;
      expect(existsSync(p)).toBe(true);
      // frame0 also exists for the select-screen portrait
      expect(existsSync(p.replace("sheet.png", "frame0.png"))).toBe(true);
      // manifest.json agrees with the registry (source of truth)
      const man = JSON.parse(readFileSync(p.replace("sheet.png", "manifest.json"), "utf8"));
      expect(man.n).toBe(4);
      expect(man.frame_h).toBe(96);
      expect(man.frames[0].w).toBe(c.frames[0].w);
    }
  });

  test("fx profile present per char (P3.13 map coverage)", () => {
    for (const c of CHARACTERS) {
      expect(typeof c.fx).toBe("string");
      expect(c.fx.length).toBeGreaterThan(0);
    }
    expect(getChar("wickvenom").fx).toBe("venom");
    expect(getChar("wickcop").fx).toBe("cop");
    expect(getChar("goldenbull").fx).toBe("bull");
    expect(getChar("frostliquidator").fx).toBe("frost");
  });

  test("getChar: unknown id falls back to procedural classic (never throws)", () => {
    expect(getChar("nonexistent").id).toBe("default");
    expect(getChar(null).id).toBe("default");
    expect(getChar(undefined).id).toBe("default");
    expect(getChar("").id).toBe("default");
  });

  test("isValidCharId guards the deep-link ?char= surface", () => {
    expect(isValidCharId("wickvenom")).toBe(true);
    expect(isValidCharId("default")).toBe(true);
    expect(isValidCharId("<script>alert(1)</script>")).toBe(false);
    expect(isValidCharId("../../secrets")).toBe(false);
    expect(isValidCharId(null)).toBe(false);
  });

  test("rosterList is the full registry (select screen shows everyone)", () => {
    expect(rosterList().length).toBe(CHARACTERS.length);
  });

  test("persistence key stable (CC_CHAR_KEY)", () => {
    expect(CHAR_KEY).toBe("cc_char_v1");
  });
});
