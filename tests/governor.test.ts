import { describe, it, expect } from "vitest";
import { clampRiskFraction } from "../src/engine/governor";
import { PortfolioState } from "../src/types";

const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0.2 };

describe("drawdown governor", () => {
  it("clamps risk to <=10% of remaining budget", () => {
    // remaining = 0.3 - 0.2 = 0.1; max allowed = 0.01
    const out = clampRiskFraction(0.05, state);
    expect(out.clamped).toBe(true);
    expect(out.riskFraction).toBeCloseTo(0.01, 6);
  });
  it("passes through when within budget", () => {
    const out = clampRiskFraction(0.005, state);
    expect(out.clamped).toBe(false);
    expect(out.riskFraction).toBe(0.005);
  });
});
