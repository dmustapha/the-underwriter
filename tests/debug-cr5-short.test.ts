// DEBUG (post-review CR-5) — short-side envelope coverage. All prior tests used side:long;
// the engine's short logic (stop = nearest resistance ABOVE entry, TP = nearest support BELOW)
// was unexercised. A judge trying a short would otherwise hit cold code.
import { describe, it, expect } from "vitest";
import { underwrite } from "../src/engine/envelope";
import { Signals, PortfolioState, TradeRequest } from "../src/types";

const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
const shortReq: TradeRequest = { token: "BNB", side: "short", intendedSize: 1000 };
const sig = (p: Partial<Signals>): Signals =>
  ({ entryPrice: 600, support: [560], resistance: [610], fib: [], rsi: 50, fearGreed: 50, altSeason: 50, degraded: false, ...p });

describe("CR-5 short-side envelope", () => {
  it("APPROVE/SIZE_DOWN: stop = resistance ABOVE entry, TP = support BELOW, R:R from those", () => {
    // entry 600, stop 610 (risk 10), tp 560 (reward 40) -> R:R 4.0 >= 2.0
    const env = underwrite(shortReq, sig({}), state);
    expect(["APPROVE", "SIZE_DOWN"]).toContain(env.verdict);
    expect(env.stop).toBe(610);            // above entry (short stop)
    expect(env.takeProfit).toBe(560);      // below entry (short TP)
    expect(env.stop).toBeGreaterThan(env.entryPrice);
    expect(env.takeProfit).toBeLessThan(env.entryPrice);
    expect(env.rewardRisk).toBeCloseTo((600 - 560) / (610 - 600), 6); // 4.0
    expect(env.size).toBeGreaterThan(0);
  });

  it("DECLINE on poor short R:R (true exclusion, size 0)", () => {
    // entry 600, stop 605 (risk 5), tp 598 (reward 2) -> R:R 0.4 < 2.0
    const env = underwrite(shortReq, sig({ resistance: [605], support: [598] }), state);
    expect(env.verdict).toBe("DECLINE");
    expect(env.size).toBe(0);
  });

  it("fail-safe DECLINE on degraded signals (short, never fail-open)", () => {
    const env = underwrite(shortReq, sig({ degraded: true, support: [], resistance: [] }), state);
    expect(env.verdict).toBe("DECLINE");
    expect(env.degraded).toBe(true);
    expect(env.size).toBe(0);
  });

  it("negative size guard applies to shorts too (DBG-005)", () => {
    const env = underwrite({ ...shortReq, intendedSize: -1000 }, sig({}), state);
    expect(env.verdict).not.toBe("APPROVE");
    expect(env.size).toBeGreaterThanOrEqual(0);
  });
});
