// DEBUG Phase 5 — Edge cases + security inputs, engine level (no network confound).
// The /api/underwrite route makes up to 4 live CMC calls per request, so curl-level edge testing is
// confounded by network latency/rate-limits. These tests drive the pure engine + adapter directly on
// the REAL committed fixture, isolating numeric/degraded edge behavior. Cases asserting CORRECT
// behavior that currently fail define the Phase 8 fix list (negative/NaN size).
import { describe, it, expect } from "vitest";
import { underwrite } from "../src/engine/envelope";
import { toSignals } from "../src/clients/cmcAdapter";
import { cmcClient } from "../src/clients/cmcClient";
import { RawJson, PortfolioState, Signals } from "../src/types";

const ta = cmcClient.getTechnicalAnalysisCached("BNB").data as RawJson; // real closed-form fixture
const regime = { fearGreed: 72, altSeason: 65 };
const goodSig: Signals = toSignals(ta, 614, regime); // entry with healthy R:R (APPROVE path)
const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
const reqBase = { token: "BNB", side: "long" as const };

describe("P5 engine numeric edge cases (no network)", () => {
  it("sanity: valid positive size at good R:R → APPROVE/SIZE_DOWN, finite non-negative size", () => {
    const env = underwrite({ ...reqBase, intendedSize: 1000 }, goodSig, state);
    expect(["APPROVE", "SIZE_DOWN"]).toContain(env.verdict);
    expect(Number.isFinite(env.size)).toBe(true);
    expect(env.size).toBeGreaterThanOrEqual(0);
  });

  it("negative intendedSize → never an APPROVE with negative size (must reject/clamp)", () => {
    const env = underwrite({ ...reqBase, intendedSize: -5000 }, goodSig, state);
    expect(env.size).toBeGreaterThanOrEqual(0);                 // a position size can't be negative
    if (env.size === 0) expect(env.verdict).toBe("DECLINE");    // zero size must read as DECLINE, not APPROVE
    expect(env.verdict).not.toBe("APPROVE");                    // approving a negative order is nonsensical
  });

  it("NaN / missing intendedSize → finite size, never APPROVE NaN", () => {
    const env = underwrite({ ...reqBase, intendedSize: NaN }, goodSig, state);
    expect(Number.isNaN(env.size)).toBe(false);
    expect(env.verdict).not.toBe("APPROVE");
  });

  it("zero intendedSize → size 0 and not a positive-size APPROVE", () => {
    const env = underwrite({ ...reqBase, intendedSize: 0 }, goodSig, state);
    expect(env.size).toBe(0);
    expect(env.verdict).not.toBe("APPROVE"); // approving a $0 position is a no-op masquerading as a fill
  });

  it("huge intendedSize → SIZE_DOWN to a finite governor-bounded notional (correct)", () => {
    const env = underwrite({ ...reqBase, intendedSize: 1e308 }, goodSig, state);
    expect(env.verdict).toBe("SIZE_DOWN");
    expect(Number.isFinite(env.size)).toBe(true);
    expect(env.size).toBeLessThan(1e308);
  });

  it("all numeric envelope fields are finite for valid input (no NaN/Infinity leak)", () => {
    const env = underwrite({ ...reqBase, intendedSize: 1000 }, goodSig, state);
    for (const v of [env.size, env.stop, env.takeProfit, env.rewardRisk, env.regimeK,
                     env.cmcLevels.support, env.cmcLevels.resistance]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe("P5 fail-safe + degraded edges (F-008)", () => {
  it("empty support/resistance → degraded DECLINE, size 0 (never fail-open)", () => {
    const env = underwrite({ ...reqBase, intendedSize: 1000 }, toSignals({}, 600, regime), state);
    expect(env.verdict).toBe("DECLINE");
    expect(env.degraded).toBe(true);
    expect(env.size).toBe(0);
  });

  it("garbage (non-numeric) level data is filtered → degraded DECLINE, not a crash", () => {
    const garbage = { support_levels: ["x", null, NaN], resistance_levels: "oops", entry: 600 } as RawJson;
    const sig = toSignals(garbage, 600, regime);
    expect(sig.degraded).toBe(true);
    const env = underwrite({ ...reqBase, intendedSize: 1000 }, sig, state);
    expect(env.verdict).toBe("DECLINE");
  });
});

describe("P5 per-instance isolation (RC-10) — underwrite is pure on its state arg", () => {
  it("two requests with different portfolio states do not interfere; near-exhausted DD budget clamps smaller", () => {
    const fresh: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
    const stressed: PortfolioState = { equity: 7000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0.29 };
    const a = underwrite({ ...reqBase, intendedSize: 100000 }, goodSig, fresh);   // huge ask → governor-bounded
    const b = underwrite({ ...reqBase, intendedSize: 100000 }, goodSig, stressed); // tiny remaining budget
    // independent results: the stressed instance is clamped to a strictly smaller size than the fresh one.
    expect(b.size).toBeLessThan(a.size);
    // re-running A again yields the SAME size → no shared mutable state leaked between calls.
    const a2 = underwrite({ ...reqBase, intendedSize: 100000 }, goodSig, fresh);
    expect(a2.size).toBeCloseTo(a.size, 6);
  });
});
