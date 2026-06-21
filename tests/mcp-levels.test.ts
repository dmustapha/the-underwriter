// Fix 3 — derive stop/TP levels from a REAL captured CoinMarketCap MCP technical-analysis payload
// (scripts/probe-mcp-ta.ts, BNB). Pins the parser to the live field names and proves the validity
// gate: when CMC's snapshot levels don't bracket the entry on both sides, it returns null so the
// underwrite path falls through to live klines (never a degenerate APPROVE).
import { describe, it, expect } from "vitest";
import { candidateLevels, levelsFromCmcTA } from "../src/clients/mcpClient";

// verbatim from the live probe (CMC was ~$620 at capture; demo entry is ~$560)
const TA = {
  moving_averages: {
    simple_moving_average_7_day: "597.94", simple_moving_average_30_day: "624.48", simple_moving_average_200_day: "707.26",
    exponential_moving_average_7_day: "592.99", exponential_moving_average_30_day: "615.13", exponential_moving_average_200_day: "688.68",
  },
  macd: { macdLine: "-13.6", signalLine: "-12.35", histogram: "-1.25" },
  rsi: { rsi7: "39.41", rsi14: "41.23", rsi21: "42.75" },
  fibonacciLevels: {
    swingHigh: "743.36", swingLow: "558.39",
    retracementLevels: { "50.0%": "650.87", "23.6%": "699.71", "38.2%": "672.7", "78.6%": "597.97", "61.8%": "629.05" },
    extensionLevels: { "161.8%": "857.67", "127.2%": "793.67", "200.0%": "928.33" },
  },
  pivotPoint: "585.29",
};

describe("CMC MCP technical-analysis level builder (Fix 3)", () => {
  it("flattens fib + pivot + MAs into sorted numeric candidate levels", () => {
    const lv = candidateLevels(TA);
    expect(lv).toContain(585.29);   // pivot
    expect(lv).toContain(743.36);   // swing high
    expect(lv).toContain(707.26);   // sma 200
    expect(lv).toContain(650.87);   // fib 50%
    expect(lv.every((x, i) => i === 0 || x >= lv[i - 1])).toBe(true); // ascending
  });

  it("brackets a mid-range entry into support + resistance with RSI", () => {
    const out = levelsFromCmcTA(TA, 650);
    expect(out).not.toBeNull();
    expect(out!.support.every((x) => x < 650)).toBe(true);
    expect(out!.resistance.every((x) => x > 650)).toBe(true);
    expect(out!.support.length).toBeGreaterThan(0);
    expect(out!.resistance.length).toBeGreaterThan(0);
    expect(out!.rsi).toBeCloseTo(41.23, 1); // rsi14
  });

  it("returns null (-> caller falls back to klines) when levels can't bracket the entry — the demo case", () => {
    // entry 560: the only level below is swingLow 558.39, 1.6 away < the 0.5% min gap (2.8) -> degenerate
    expect(levelsFromCmcTA(TA, 560)).toBeNull();
  });
});
