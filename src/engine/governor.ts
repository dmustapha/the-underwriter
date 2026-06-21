import { PortfolioState } from "../types";
import { RISK } from "../config";

// Returns the risk fraction this trade is allowed, clamped by the remaining drawdown budget.
// remainingBudget = ddBudget - currentDrawdown; a trade may risk at most a fixed slice of it.
export function clampRiskFraction(
  intendedRiskFraction: number,
  state: PortfolioState
): { riskFraction: number; clamped: boolean; reason: string } {
  const remaining = Math.max(0, state.ddBudget - state.currentDrawdown);
  const maxAllowed = remaining * RISK.governorPerTradeFraction;
  if (intendedRiskFraction <= maxAllowed) {
    return { riskFraction: intendedRiskFraction, clamped: false, reason: `within budget (max ${(maxAllowed * 100).toFixed(2)}%)` };
  }
  return {
    riskFraction: maxAllowed,
    clamped: true,
    reason: `clamped to ${(maxAllowed * 100).toFixed(2)}% of equity (remaining DD budget ${(remaining * 100).toFixed(1)}%)`,
  };
}
