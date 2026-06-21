import { describe, it, expect } from "vitest";
import { underwrite } from "../src/engine/envelope";
import { Signals, PortfolioState, TradeRequest } from "../src/types";

const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
const req: TradeRequest = { token: "BNB", side: "long", intendedSize: 1000 };

function sig(partial: Partial<Signals>): Signals {
  return { entryPrice: 600, support: [592], resistance: [641], fib: [], rsi: 50, fearGreed: 50, altSeason: 50, degraded: false, ...partial };
}

describe("risk envelope engine", () => {
  it("DECLINEs on degraded signals (fail-safe)", () => {
    const env = underwrite(req, sig({ degraded: true, support: [], resistance: [] }), state);
    expect(env.verdict).toBe("DECLINE");
    expect(env.degraded).toBe(true);
  });
  it("DECLINEs on poor reward:risk", () => {
    // entry 600, support 592 (risk 8), resistance 601 (reward 1) -> R:R 0.125 < 1.5
    const env = underwrite(req, sig({ resistance: [601] }), state);
    expect(env.verdict).toBe("DECLINE");
    expect(env.size).toBe(0);
  });
  it("APPROVE/SIZE_DOWN on healthy reward:risk with CMC levels as stop/TP", () => {
    const env = underwrite(req, sig({}), state);
    expect(["APPROVE", "SIZE_DOWN"]).toContain(env.verdict);
    expect(env.stop).toBe(592);
    expect(env.takeProfit).toBe(641);
    expect(env.rewardRisk).toBeCloseTo((641 - 600) / (600 - 592), 4);
  });
});
