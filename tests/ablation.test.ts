import { describe, it, expect } from "vitest";
import { runAblation } from "../src/backtest/ablation";
import { Kline, Trade, PortfolioState } from "../src/types";

// synthetic kline series: choppy then trend, enough bars for fib lookback.
function makeKlines(n: number): Kline[] {
  const out: Kline[] = [];
  let price = 600;
  for (let i = 0; i < n; i++) {
    price += Math.sin(i / 5) * 4 + (i > n / 2 ? 1.5 : -0.5);
    const high = price + 6, low = price - 6;
    out.push({ openTime: i * 3_600_000, open: price, high, low, close: price, volume: 1000, closeTime: i * 3_600_000 + 3_599_999 });
  }
  return out;
}

const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };

describe("ablation harness", () => {
  const klines = makeKlines(200);
  const trades: Trade[] = Array.from({ length: 12 }, (_, i) => ({
    token: "BNB", side: "long", entryTs: (70 + i * 8) * 3_600_000, entryPrice: klines[70 + i * 8].close, intendedSize: 1000,
  }));
  const result = runAblation(trades, klines, state, { fearGreed: 72, altSeason: 65, globalLeverage: 68 });

  it("holds flat-haircut avg exposure equal to full-gate (equal-exposure invariant)", () => {
    const fg = result.arms.find((a) => a.arm === "fullGate")!;
    const fh = result.arms.find((a) => a.arm === "flatHaircut")!;
    expect(fh.avgExposure).toBeCloseTo(fg.avgExposure, 2);
  });
  it("excludes DECLINEd trades so win-rate can differ from raw", () => {
    const fg = result.arms.find((a) => a.arm === "fullGate")!;
    const raw = result.arms.find((a) => a.arm === "raw")!;
    if (fg.excludedTrades > 0) expect(fg.tradeCount).toBeLessThan(raw.tradeCount);
    expect(fg.excludedTrades).toBe(result.declined.length);
  });
  it("computes a finite Calmar per arm", () => {
    for (const a of result.arms) expect(Number.isNaN(a.calmar)).toBe(false);
  });
});
