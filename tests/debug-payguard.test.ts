// Pay guard tests — bounds grief on the public x402 endpoint (per-IP cooldown + global cap).
import { describe, it, expect, beforeEach } from "vitest";
import { allowPaidCall, __resetPayGuard } from "../src/server/payGuard";

beforeEach(() => __resetPayGuard());

describe("payGuard", () => {
  it("allows the first paid call from an IP", () => {
    expect(allowPaidCall("1.1.1.1", 1_000_000).allowed).toBe(true);
  });

  it("blocks a second call within the 20s per-IP cooldown, then allows after it", () => {
    const t = 1_000_000;
    expect(allowPaidCall("1.1.1.1", t).allowed).toBe(true);
    expect(allowPaidCall("1.1.1.1", t + 5_000).allowed).toBe(false);   // within cooldown
    expect(allowPaidCall("1.1.1.1", t + 21_000).allowed).toBe(true);   // cooldown elapsed
  });

  it("isolates IPs (one IP's cooldown doesn't block another)", () => {
    const t = 1_000_000;
    expect(allowPaidCall("1.1.1.1", t).allowed).toBe(true);
    expect(allowPaidCall("2.2.2.2", t).allowed).toBe(true);
  });

  it("enforces a global per-instance cap (60), then degrades to cached", () => {
    const t = 1_000_000;
    for (let i = 0; i < 60; i++) {
      expect(allowPaidCall(`ip-${i}`, t).allowed).toBe(true); // 60 distinct IPs, all allowed
    }
    expect(allowPaidCall("ip-overflow", t).allowed).toBe(false); // 61st blocked by global cap
  });

  it("resets the global window after 24h", () => {
    const t = 1_000_000;
    for (let i = 0; i < 60; i++) allowPaidCall(`ip-${i}`, t);
    expect(allowPaidCall("late", t).allowed).toBe(false);
    expect(allowPaidCall("late", t + 24 * 60 * 60 * 1000 + 1).allowed).toBe(true); // new window
  });
});
