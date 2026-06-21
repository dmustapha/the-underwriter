// Fix 1 reproduce guard: the extracted momentum generator must reproduce the committed BNB demo
// trade log byte-identical. If this drifts, fixtures/ablation.json (the -0.82 / -0.21 / declined-7
// headline) shifts — so this test pins the extraction to the original seed-demo.ts behaviour.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { momentumTradeLog } from "../src/signals/momentum";
import { Kline, Trade } from "../src/types";

// the SAME constants seed-demo.ts uses (FEAR_GREED, NAIVE_SIZE) over the SAME cached scan window
const FEAR_GREED = 72;
const NAIVE_SIZE = 12_000;
const SCAN_KLINES = "fixtures/klines/BNBUSDT-1d-1633046400000-1672444800000.json";
const EXPECTED = "fixtures/trade-log-momentum.json";

describe("momentum signal generator (Fix 1 extraction)", () => {
  const klines = JSON.parse(readFileSync(join(process.cwd(), SCAN_KLINES), "utf8")) as Kline[];
  const expected = JSON.parse(readFileSync(join(process.cwd(), EXPECTED), "utf8")) as Trade[];

  it("reproduces the committed 13-trade BNB demo log byte-identical", () => {
    const trades = momentumTradeLog(klines, FEAR_GREED, NAIVE_SIZE); // token defaults to "BNB"
    expect(trades).toEqual(expected);
    expect(trades).toHaveLength(13);
  });

  it("honours the token parameter (the multi-asset hook for Fix 2)", () => {
    const trades = momentumTradeLog(klines, FEAR_GREED, NAIVE_SIZE, "ETH");
    expect(trades.every((t) => t.token === "ETH")).toBe(true);
    // entries/timestamps are unchanged — only the label differs
    expect(trades.map((t) => t.entryTs)).toEqual(expected.map((t) => t.entryTs));
  });
});
