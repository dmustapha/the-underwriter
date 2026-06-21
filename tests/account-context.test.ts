// §8 — account context must actually change the verdict. The drawdown governor reads the account's
// remaining drawdown budget, so the SAME trade is sized smaller (and eventually declined) on a more
// drawn-down book. This is what proves the sizing is real account-aware risk, not a per-call constant.
import { describe, it, expect } from "vitest";
import { underwrite } from "../src/engine/envelope";
import { Signals, PortfolioState } from "../src/types";

// entry 100, stop 95 (risk 5), TP 130 (reward 30) -> R:R 6, clears the 2:1 floor -> sizeable trade.
const SIGNALS: Signals = {
  entryPrice: 100, support: [95], resistance: [130], fib: [], rsi: 50,
  fearGreed: 50, altSeason: 50, globalLeverage: 50, degraded: false,
};
const REQ = { token: "BNB", side: "long" as const, intendedSize: 100_000 };
const st = (equity: number, currentDrawdown: number): PortfolioState =>
  ({ equity, peakEquity: equity / (1 - currentDrawdown), ddBudget: 0.3, currentDrawdown });

describe("§8 account context drives sizing via the drawdown governor", () => {
  it("sizes the same trade smaller as the account's drawdown grows", () => {
    const fresh = underwrite(REQ, SIGNALS, st(10_000, 0));
    const bled = underwrite(REQ, SIGNALS, st(7_800, 0.22));
    expect(fresh.size).toBeGreaterThan(0);
    expect(bled.size).toBeGreaterThan(0);
    expect(bled.size).toBeLessThan(fresh.size); // governor tightens with drawdown
  });

  it("halts (DECLINE) once the drawdown budget is exhausted", () => {
    const blown = underwrite(REQ, SIGNALS, st(7_000, 0.30)); // currentDrawdown == ddBudget -> no capacity
    expect(blown.verdict).toBe("DECLINE");
    expect(blown.size).toBe(0);
    expect(blown.reason).toMatch(/drawdown budget exhausted/i);
  });

  it("a bigger account approves a bigger absolute size at the same risk fraction", () => {
    const small = underwrite(REQ, SIGNALS, st(10_000, 0));
    const large = underwrite(REQ, SIGNALS, st(100_000, 0));
    expect(large.size).toBeGreaterThan(small.size);
  });
});
