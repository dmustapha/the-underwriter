// Coverage for the regime multiplier — the sub-signal product that scales position size by froth.
// Exercises every band boundary, the K_MIN floor, partialRegime, and the NEW opt-in directional /
// RSI behavior (both default OFF so the locked backtest path is byte-identical to legacy).
import { describe, it, expect } from "vitest";
import { regimeMultiplier } from "../src/engine/regime";
import { RISK } from "../src/config";
import { Signals } from "../src/types";

// neutral signals with overridable regime fields; globalLeverage present by default so levMult fires.
const sig = (p: Partial<Signals> = {}): Signals => ({
  entryPrice: 600, support: [], resistance: [], fib: [], rsi: 50,
  fearGreed: 50, altSeason: 50, globalLeverage: 50, degraded: false, ...p,
});

describe("regimeMultiplier — band boundaries (legacy / default opts)", () => {
  it("F&G band: 74 -> x0.75, 75 -> x0.5 (the >=75 boundary)", () => {
    const at74 = regimeMultiplier(sig({ fearGreed: 74 })).k;
    const at75 = regimeMultiplier(sig({ fearGreed: 75 })).k;
    expect(at74).toBeCloseTo(0.75, 6); // 0.75 * 1 * 1
    expect(at75).toBeCloseTo(0.5, 6);  // 0.5  * 1 * 1
  });
  it("F&G band: 59 -> x1.0, 60 -> x0.75 (the >=60 boundary)", () => {
    expect(regimeMultiplier(sig({ fearGreed: 59 })).k).toBeCloseTo(1.0, 6);
    expect(regimeMultiplier(sig({ fearGreed: 60 })).k).toBeCloseTo(0.75, 6);
  });

  it("altSeason band: 74 -> x0.85, 75 -> x0.7 (the >=75 boundary)", () => {
    expect(regimeMultiplier(sig({ altSeason: 74 })).k).toBeCloseTo(0.85, 6);
    expect(regimeMultiplier(sig({ altSeason: 75 })).k).toBeCloseTo(0.7, 6);
  });
  it("altSeason band: 59 -> x1.0, 60 -> x0.85 (the >=60 boundary)", () => {
    expect(regimeMultiplier(sig({ altSeason: 59 })).k).toBeCloseTo(1.0, 6);
    expect(regimeMultiplier(sig({ altSeason: 60 })).k).toBeCloseTo(0.85, 6);
  });

  it("mktRisk (globalLeverage) band: 74 -> x0.85, 75 -> x0.7 (the >=75 boundary)", () => {
    expect(regimeMultiplier(sig({ globalLeverage: 74 })).k).toBeCloseTo(0.85, 6);
    expect(regimeMultiplier(sig({ globalLeverage: 75 })).k).toBeCloseTo(0.7, 6);
  });
  it("mktRisk band: 59 -> x1.0, 60 -> x0.85 (the >=60 boundary)", () => {
    expect(regimeMultiplier(sig({ globalLeverage: 59 })).k).toBeCloseTo(1.0, 6);
    expect(regimeMultiplier(sig({ globalLeverage: 60 })).k).toBeCloseTo(0.85, 6);
  });
});

describe("regimeMultiplier — K_MIN floor & partialRegime", () => {
  it("all-frothy product (0.5*0.7*0.7=0.245) floors to kMin=0.25", () => {
    const r = regimeMultiplier(sig({ fearGreed: 90, altSeason: 90, globalLeverage: 90 }));
    expect(0.5 * 0.7 * 0.7).toBeLessThan(RISK.kMin); // sanity: raw is below the floor
    expect(r.k).toBe(RISK.kMin);
  });

  it("globalLeverage absent -> partialRegime true + rationale notes 'mktRisk n/a'", () => {
    const r = regimeMultiplier(sig({ globalLeverage: undefined }));
    expect(r.partialRegime).toBe(true);
    expect(r.rationale).toContain("mktRisk n/a");
  });
  it("globalLeverage present -> partialRegime false + rationale cites the value", () => {
    const r = regimeMultiplier(sig({ globalLeverage: 68 }));
    expect(r.partialRegime).toBe(false);
    expect(r.rationale).toContain("mktRisk 68");
  });
});

describe("regimeMultiplier — opt-in directional behavior (side)", () => {
  it("short side neutralizes froth: k higher than long in greed", () => {
    const frothy = sig({ fearGreed: 80, altSeason: 80, globalLeverage: 80 });
    const long = regimeMultiplier(frothy, { side: "long" }).k;
    const short = regimeMultiplier(frothy, { side: "short" }).k;
    expect(short).toBeGreaterThan(long);
    expect(short).toBe(1.0); // froth-neutral, no other gate active
  });
  it("short rationale flags froth-neutral", () => {
    const r = regimeMultiplier(sig({ fearGreed: 80 }), { side: "short" });
    expect(r.rationale).toContain("short (froth-neutral)");
  });
});

describe("regimeMultiplier — opt-in RSI momentum gate (useRsi)", () => {
  it("long & rsi>=70 -> additional x0.8", () => {
    const base = regimeMultiplier(sig({ rsi: 70 }), { side: "long" }).k;        // no rsi gate path
    const gated = regimeMultiplier(sig({ rsi: 70 }), { side: "long", useRsi: true }).k;
    expect(gated).toBeCloseTo(base * 0.8, 6);
  });
  it("long & rsi<70 -> RSI gate inactive (no shrink)", () => {
    const a = regimeMultiplier(sig({ rsi: 69 }), { side: "long", useRsi: true }).k;
    const b = regimeMultiplier(sig({ rsi: 69 }), { side: "long" }).k;
    expect(a).toBeCloseTo(b, 6);
  });
  it("short & rsi<=30 -> additional x0.8 (froth still neutral)", () => {
    const gated = regimeMultiplier(sig({ rsi: 30 }), { side: "short", useRsi: true }).k;
    expect(gated).toBeCloseTo(0.8, 6); // froth neutral (1.0) * rsi 0.8
  });
  it("short & rsi>30 -> RSI gate inactive", () => {
    const r = regimeMultiplier(sig({ rsi: 31 }), { side: "short", useRsi: true }).k;
    expect(r).toBeCloseTo(1.0, 6);
  });
});

describe("regimeMultiplier — default opts == legacy (byte-identical backtest path)", () => {
  it("frothy long with no opts equals {side:'long'} (the RSI effect is the only difference, and it is off)", () => {
    const s = sig({ fearGreed: 80, altSeason: 80, globalLeverage: 80, rsi: 75 });
    const legacy = regimeMultiplier(s);                       // no opts
    const explicitLong = regimeMultiplier(s, { side: "long" }); // froth still shrinks longs, RSI off
    expect(explicitLong.k).toBeCloseTo(legacy.k, 6);
  });
  it("legacy path ignores RSI entirely (rationale has no RSI note)", () => {
    const r = regimeMultiplier(sig({ rsi: 90 }));
    expect(r.rationale).not.toContain("RSI");
  });
});
