// Oracle tests for the LOCKED indicators module (tested, never edited). Every expected value is
// computed BY HAND from the formula — never observe-then-assert — so a silent formula change fails here.
import { describe, it, expect } from "vitest";
import { pivots, fibLevels, rsi, computeLevels } from "../src/engine/indicators";
import { INDI } from "../src/config";
import { Kline } from "../src/types";

const bar = (o: number, h: number, l: number, c: number, i = 0): Kline => ({
  openTime: i * 86_400_000, open: o, high: h, low: l, close: c, volume: 1000,
  closeTime: i * 86_400_000 + 86_399_999,
});

describe("pivots — floor-trader formula, hand-computed", () => {
  it("derives p, r1, r2, s1, s2 from one bar (high=110, low=90, close=100)", () => {
    // p=(110+90+100)/3=100; r1=2p-low=110; s1=2p-high=90; r2=p+(h-l)=120; s2=p-(h-l)=80
    const p = pivots(bar(100, 110, 90, 100));
    expect(p.p).toBeCloseTo(100, 6);
    expect(p.r1).toBeCloseTo(110, 6);
    expect(p.s1).toBeCloseTo(90, 6);
    expect(p.r2).toBeCloseTo(120, 6);
    expect(p.s2).toBeCloseTo(80, 6);
  });
});

describe("fibLevels — retracement ratios over a window", () => {
  it("maps each ratio to lo + range*ratio (lo=90, hi=110, range=20)", () => {
    const window = [bar(0, 110, 100, 105, 0), bar(0, 100, 90, 95, 1)]; // hi=110, lo=90
    const fib = fibLevels(window);
    const byRatio = (r: number) => fib.find((f) => f.ratio === r)!.price;
    expect(byRatio(0)).toBeCloseTo(90, 6);     // lo
    expect(byRatio(0.5)).toBeCloseTo(100, 6);  // lo + 20*0.5
    expect(byRatio(1)).toBeCloseTo(110, 6);    // hi
    expect(byRatio(0.236)).toBeCloseTo(90 + 20 * 0.236, 6);
    expect(byRatio(0.618)).toBeCloseTo(90 + 20 * 0.618, 6);
    expect(fib.map((f) => f.ratio)).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
  });
});

describe("rsi — edge behavior", () => {
  it("all-gains series -> 100 (loss === 0)", () => {
    const closes = Array.from({ length: INDI.rsiPeriod + 1 }, (_, i) => 100 + i);
    expect(rsi(closes)).toBe(100);
  });
  it("series shorter than period+1 -> neutral 50", () => {
    const closes = Array.from({ length: INDI.rsiPeriod }, (_, i) => 100 + i); // one short
    expect(rsi(closes)).toBe(50);
  });
  it("balanced up/down within the window -> 50 (rs=1)", () => {
    // last `period` diffs: alternating +1/-1 over an even period sums equal gain & loss -> rs=1 -> 50
    const closes: number[] = [100];
    for (let i = 1; i <= INDI.rsiPeriod; i++) closes.push(closes[i - 1] + (i % 2 === 1 ? 1 : -1));
    expect(rsi(closes)).toBeCloseTo(50, 6);
  });
});

describe("computeLevels — support/resistance partition around entry", () => {
  it("support strictly < entry, resistance strictly > entry", () => {
    // build a 60+ bar window so fibLookback is satisfied and levels span the entry.
    const window: Kline[] = [];
    for (let i = 0; i < 65; i++) {
      const base = 100 + Math.sin(i / 3) * 10;
      window.push(bar(base, base + 8, base - 8, base, i));
    }
    const entry = 100;
    const { support, resistance } = computeLevels(window, entry);
    expect(support.length + resistance.length).toBeGreaterThan(0);
    for (const x of support) expect(x).toBeLessThan(entry);
    for (const x of resistance) expect(x).toBeGreaterThan(entry);
    // ascending order invariant
    expect([...support].sort((a, b) => a - b)).toEqual(support);
    expect([...resistance].sort((a, b) => a - b)).toEqual(resistance);
  });
});
