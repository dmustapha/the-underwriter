// DEBUG Phase 3 — Integration: cmcClient(cache) → cmcAdapter → envelope engine.
// This is the LIVE /api/underwrite data path when CMC keys are absent (the demo default, DEV-007):
// the closed-form TA fixture is read by cmcClient.getTechnicalAnalysisCached, shaped into Signals by
// cmcAdapter.toSignals, and consumed by the envelope engine. Validates the connection on the REAL
// committed fixture (not synthetic data) and the fail-safe path when no fixture exists.
import { describe, it, expect } from "vitest";
import { cmcClient } from "../src/clients/cmcClient";
import { toSignals } from "../src/clients/cmcAdapter";
import { underwrite } from "../src/engine/envelope";
import { RawJson, PortfolioState } from "../src/types";
import { RISK } from "../src/config";

const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
const regime = { fearGreed: 72, altSeason: 65 };

describe("P3 client→adapter→engine integration (live underwrite path, cache tier)", () => {
  it("cmcClient.getTechnicalAnalysisCached('BNB') returns the real closed-form fixture, non-degraded", () => {
    const ta = cmcClient.getTechnicalAnalysisCached("BNB");
    expect(ta.source).toBe("cache");
    expect(ta.degraded).toBe(false);
    const d = ta.data as RawJson;
    expect(Array.isArray(d.support_levels)).toBe(true);
    expect(Array.isArray(d.resistance_levels)).toBe(true);
    expect((d.support_levels as number[]).length).toBeGreaterThan(0);
    expect((d.resistance_levels as number[]).length).toBeGreaterThan(0);
  });

  it("toSignals(real fixture) → underwrite at entry 614 → APPROVE with full envelope from CMC levels (F-001/F-002)", () => {
    const ta = cmcClient.getTechnicalAnalysisCached("BNB").data as RawJson;
    const signals = toSignals(ta, 614, regime);
    expect(signals.degraded).toBe(false);
    const env = underwrite({ token: "BNB", side: "long", intendedSize: 1000 }, signals, state);
    // F-001: the envelope is the FULL set — every field present and meaningful.
    expect(env.verdict).toBe("APPROVE");
    expect(env.size).toBeGreaterThan(0);
    expect(env.rewardRisk).toBeGreaterThanOrEqual(RISK.rrMin); // rrMin = 2.0 (locked)
    expect(typeof env.reason).toBe("string");
    expect(env.reason.length).toBeGreaterThan(0);
    // F-002: stop/TP are CMC support/resistance, not the entry price.
    expect(env.stop).not.toBe(env.entryPrice);
    expect(env.takeProfit).not.toBe(env.entryPrice);
    expect(signals.support).toContain(env.stop);        // long stop = a support level
    expect(signals.resistance).toContain(env.takeProfit); // long TP = a resistance level
    expect(env.stop).toBeLessThan(614);
    expect(env.takeProfit).toBeGreaterThan(614);
  });

  it("at the fixture's own (current) entry the same path DECLINEs on poor reward:risk (on-narrative)", () => {
    const ta = cmcClient.getTechnicalAnalysisCached("BNB").data as RawJson;
    const currentEntry = (ta.entry as number); // ~617.87 — the blank-entry demo input
    const signals = toSignals(ta, currentEntry, regime);
    const env = underwrite({ token: "BNB", side: "long", intendedSize: 1000 }, signals, state);
    expect(env.verdict).toBe("DECLINE");
    expect(env.rewardRisk).toBeLessThan(RISK.rrMin);
  });

  it("fail-safe DECLINE (F-008): unknown token has no TA fixture → degraded → DECLINE, never oversized APPROVE", () => {
    const ta = cmcClient.getTechnicalAnalysisCached("DOGE"); // no fixture committed
    expect(ta.degraded).toBe(true);
    const signals = toSignals(ta.data as RawJson, 600, regime);
    expect(signals.degraded).toBe(true);
    const env = underwrite({ token: "DOGE", side: "long", intendedSize: 1000 }, signals, state);
    expect(env.verdict).toBe("DECLINE");
    expect(env.degraded).toBe(true);
    expect(env.size).toBe(0);
  });
});
