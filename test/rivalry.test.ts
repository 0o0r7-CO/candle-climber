/// <reference types="bun-types" />
// P3.1 rivalry tag — contract tests for the death-card challenge stamp (bun test).
// normalizeRivalTag is a pure, canvas-free helper (same pattern as milestoneLines):
// it is the single gate between raw user input and the shared card, so the W5
// suite pins it: accept the X-legal alphabet, tolerate one leading @, reject
// everything else as null (the card then simply omits the stamp — never mangles).
import { describe, test, expect } from "bun:test";
import { normalizeRivalTag } from "@/game/cc/deathcard";

describe("P3.1 rivalry tag normalizer", () => {
  test("accepts plain handles and normalizes to @-prefixed form", () => {
    expect(normalizeRivalTag("satoshifriend")).toBe("@satoshifriend");
    expect(normalizeRivalTag("WickHunter_99")).toBe("@WickHunter_99");
  });

  test("tolerates one leading @ (users will type it)", () => {
    expect(normalizeRivalTag("@satoshifriend")).toBe("@satoshifriend");
    expect(normalizeRivalTag("  @handle7  ")).toBe("@handle7"); // trim + strip
  });

  test("X-legal alphabet only: letters, digits, underscore", () => {
    expect(normalizeRivalTag("a_b-c")).toBeNull(); // hyphen not in X alphabet
    expect(normalizeRivalTag("has space")).toBeNull();
    expect(normalizeRivalTag("🎉")).toBeNull();
  });

  test("enforces X length rule: 1–15 after stripping @", () => {
    expect(normalizeRivalTag("a")).toBe("@a");
    expect(normalizeRivalTag("x".repeat(15))).toBe("@" + "x".repeat(15));
    expect(normalizeRivalTag("x".repeat(16))).toBeNull();
    expect(normalizeRivalTag("")).toBeNull();
    expect(normalizeRivalTag("   ")).toBeNull();
    expect(normalizeRivalTag("@")).toBeNull(); // @ with empty handle
  });

  test("rejects embedded/multiple @ (only a LEADING one is stripped)", () => {
    expect(normalizeRivalTag("a@b")).toBeNull();
    expect(normalizeRivalTag("@@handle")).toBe("@handle"); // /^@+/ strips run of @
  });
});
