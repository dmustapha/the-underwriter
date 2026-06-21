// DEBUG (post-review CR-4) — INDEPENDENT ORACLE for the ablation core math.
// The P3 determinism test is circular (re-runs the same engine vs the served fixture). This test
// hand-computes realizeTrade / simulate / Calmar on a tiny crafted series and asserts the engine
// matches — validating CORRECTNESS, not just consistency. Every expected number below is derived
// by hand in the comments.
import { describe, it, expect } from "vitest";
import { realizeTrade, simulate, Execution } from "../src/backtest/ablation";
import { Kline } from "../src/types";

// minimal kline; only high/low/close matter to realizeTrade/simulate.
const k = (high: number, low: number, close: number, i = 0): Kline =>
  ({ openTime: i, open: close, high, low, close, volume: 0, closeTime: i });

describe("CR-4 oracle: realizeTrade (long)", () => {
  // entry 100, stop 90, tp 120, notional 1000 -> units = 1000/100 = 10
  const ex: Execution = { entryIndex: 0, entry: 100, stop: 90, tp: 120, notional: 1000, side: "long" };
  it("TP hit first -> +units*(tp-entry) = 10*(120-100) = +200", () => {
    expect(realizeTrade([k(105, 98, 100), k(121, 115, 120)], ex)).toBe(200);
  });
  it("stop hit first -> units*(stop-entry) = 10*(90-100) = -100", () => {
    expect(realizeTrade([k(105, 98, 100), k(95, 88, 90)], ex)).toBe(-100);
  });
  it("both touched same bar -> stop checked FIRST for long (conservative) = -100", () => {
    expect(realizeTrade([k(105, 98, 100), k(130, 85, 110)], ex)).toBe(-100);
  });
  it("unresolved -> mark to last close: 10*(105-100) = +50", () => {
    expect(realizeTrade([k(105, 98, 100), k(110, 95, 105)], ex)).toBe(50);
  });
});

describe("CR-4 oracle: realizeTrade (short) — CR-5 coverage at engine level", () => {
  // entry 100, stop 110 (above), tp 80 (below), notional 1000 -> units = 10
  const ex: Execution = { entryIndex: 0, entry: 100, stop: 110, tp: 80, notional: 1000, side: "short" };
  it("TP hit first -> units*(entry-tp) = 10*(100-80) = +200", () => {
    expect(realizeTrade([k(105, 98, 100), k(105, 79, 85)], ex)).toBe(200);
  });
  it("stop hit first -> units*(entry-stop) = 10*(100-110) = -100", () => {
    expect(realizeTrade([k(105, 98, 100), k(112, 95, 108)], ex)).toBe(-100);
  });
  it("both touched -> stop (high>=stop) checked FIRST for short = -100", () => {
    expect(realizeTrade([k(105, 98, 100), k(115, 75, 90)], ex)).toBe(-100);
  });
});

describe("CR-4 oracle: simulate equity/drawdown/Calmar (losing-from-start path — the demo's bear regime)", () => {
  // Two long trades, each loses 100. start equity 10000.
  // klines: idx0 entryA, idx1 stop-A, idx2 entryB, idx3 stop-B.
  const klines = [k(105, 98, 100, 0), k(95, 88, 90, 1), k(105, 98, 100, 2), k(95, 88, 90, 3)];
  const execA: Execution = { entryIndex: 0, entry: 100, stop: 90, tp: 120, notional: 1000, side: "long" };
  const execB: Execution = { entryIndex: 2, entry: 100, stop: 90, tp: 120, notional: 1000, side: "long" };

  // HAND DERIVATION (notional 1000):
  //   A: exposure 1000/10000=0.1; pnl -100; equity 9900; peak 10000; DD (10000-9900)/10000=0.01
  //   B: exposure 1000/9900=0.1010101; pnl -100; equity 9800; peak 10000; DD (10000-9800)/10000=0.02
  //   totalReturn=(9800-10000)/10000=-0.02 ; maxDD=0.02 ; calmar=-0.02/0.02=-1.0
  //   avgExposure=(0.1+0.1010101)/2=0.1005050 ; winRate=0 ; tradeCount=2
  it("matches the hand-computed metrics exactly", () => {
    const { result, curve } = simulate([execA, execB], klines, 10000);
    expect(result.totalReturn).toBeCloseTo(-0.02, 9);
    expect(result.maxDrawdown).toBeCloseTo(0.02, 9);
    expect(result.calmar).toBeCloseTo(-1.0, 9);
    expect(result.avgExposure).toBeCloseTo(0.10050505, 7);
    expect(result.winRate).toBe(0);
    expect(result.tradeCount).toBe(2);
    expect(curve).toEqual([10000, 9900, 9800]);
  });

  // CR-1 SUBSTANTIATION: the "a flat haircut can't change Calmar" claim.
  // Scale notional by 0.5 -> each loss halves (-50). On a losing-from-start path the peak stays at
  // startEquity, so maxDD and return BOTH scale by exactly 0.5 and Calmar is EXACTLY invariant.
  //   A: equity 9950 DD 0.005 ; B: equity 9900 DD 0.01 ; return -0.01 ; calmar -0.01/0.01 = -1.0
  it("flat haircut is EXACTLY Calmar-invariant on a losing-from-start path (peak==start)", () => {
    const half = [{ ...execA, notional: 500 }, { ...execB, notional: 500 }];
    const { result } = simulate(half, klines, 10000);
    expect(result.totalReturn).toBeCloseTo(-0.01, 9); // halved
    expect(result.maxDrawdown).toBeCloseTo(0.01, 9);   // halved
    expect(result.calmar).toBeCloseTo(-1.0, 9);        // UNCHANGED -> a flat size cut can't move it
  });

  // HONESTY GUARD: the invariance above is EXACT only because equity never exceeds its start (bear).
  // If a trade wins first (peak>start), the peak denominator breaks exact scaling -> invariance is
  // only APPROXIMATE. This documents the limit of the scale-invariance claim.
  it("on a winning-first path (peak>start) scale-invariance is only approximate, not exact", () => {
    // entry100 stop90 tp120; bar1 wins (+200), bar3 loses (-100). peak rises above start.
    const kl = [k(105, 98, 100, 0), k(121, 115, 120, 1), k(105, 98, 100, 2), k(95, 88, 90, 3)];
    const full = simulate([execA, execB], kl, 10000).result;       // A +200, B -100
    const half = simulate([{ ...execA, notional: 500 }, { ...execB, notional: 500 }], kl, 10000).result; // A +100, B -50
    // returns scale exactly by 0.5, but Calmar does NOT (peak differs: 10200 vs 10100)
    expect(half.totalReturn).toBeCloseTo(full.totalReturn * 0.5, 9);
    expect(half.calmar).not.toBeCloseTo(full.calmar, 4); // proves: NOT a universal identity
  });
});
