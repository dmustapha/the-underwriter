import { TradeRequest, Signals, RiskEnvelope, PortfolioState, X402Receipt, Side } from "../types";
import { RISK } from "../config";
import { regimeMultiplier } from "./regime";
import { clampRiskFraction } from "./governor";

function nearestBelow(levels: number[], price: number): number | undefined {
  const below = levels.filter((x) => x < price);
  return below.length ? Math.max(...below) : undefined;
}
function nearestAbove(levels: number[], price: number): number | undefined {
  const above = levels.filter((x) => x > price);
  return above.length ? Math.min(...above) : undefined;
}

// Core underwriting. Source-agnostic: `s` may be CMC-derived (live) or OHLCV-derived (backtest).
export function underwrite(
  req: TradeRequest,
  s: Signals,
  state: PortfolioState,
  receipts: X402Receipt[] = []
): RiskEnvelope {
  const entry = s.entryPrice;
  const base = baseEnvelope(req, entry, s, receipts);

  // Input guard: intendedSize must be a positive, finite USD notional. A negative/NaN/zero ask is
  // invalid input — DECLINE it (never let it slip through `Math.min` into an APPROVE with a bad size).
  if (!Number.isFinite(req.intendedSize) || req.intendedSize <= 0) {
    return {
      ...base.shell,
      size: 0, stop: entry, takeProfit: entry, rewardRisk: 0,
      verdict: "DECLINE",
      reason: `invalid intended size (${req.intendedSize}) — must be a positive number`,
      degraded: false,
    };
  }

  // Fail-safe: missing risk signals -> DECLINE (never fail-open).
  if (s.degraded || base.stop === undefined || base.takeProfit === undefined) {
    return {
      ...base.shell,
      size: 0, stop: entry, takeProfit: entry, rewardRisk: 0,
      verdict: "DECLINE",
      reason: "risk signals unavailable (support/resistance missing) — declining by default",
      degraded: true,
    };
  }

  const stop = base.stop;
  const tp = base.takeProfit;
  const stopDist = Math.abs(entry - stop);
  const rewardRisk = Math.abs(tp - entry) / stopDist;

  // Decline on poor reward:risk — a true exclusion, not size 0 in disguise.
  if (rewardRisk < RISK.rrMin) {
    return {
      ...base.shell,
      size: 0, stop, takeProfit: tp, rewardRisk,
      cmcLevels: base.cmcLevels,
      verdict: "DECLINE",
      reason: `reward:risk ${rewardRisk.toFixed(2)} < ${RISK.rrMin} (support ${stop.toFixed(2)}, resistance ${tp.toFixed(2)}) — excluded`,
      degraded: false,
    };
  }

  // Size off stop distance, scaled by regime, clamped by drawdown governor.
  const regime = regimeMultiplier(s);
  const intendedRiskFraction = RISK.baseRiskFraction * regime.k;
  const clamp = clampRiskFraction(intendedRiskFraction, state);
  const riskCapital = state.equity * clamp.riskFraction;   // USD at risk
  const notional = (riskCapital * entry) / stopDist;        // USD notional that risks exactly riskCapital
  const size = Math.min(req.intendedSize, notional);

  // [CRITIQUE #6] drawdown budget exhausted → size clamps to 0. That is a HARD halt, not a "size down"
  // (an approval-class verdict with a $0 fill is a no-op masquerading as a trade). DECLINE it outright.
  if (!(size > 0)) {
    const remaining = Math.max(0, state.ddBudget - state.currentDrawdown);
    return {
      ...base.shell,
      size: 0, stop, takeProfit: tp, rewardRisk,
      cmcLevels: base.cmcLevels,
      verdict: "DECLINE",
      reason: `drawdown budget exhausted — no remaining risk capacity (DD budget ${(remaining * 100).toFixed(1)}% left) — halting`,
      degraded: false,
    };
  }
  const verdict = size < req.intendedSize ? "SIZE_DOWN" : "APPROVE";

  const reason =
    verdict === "APPROVE"
      ? `approved $${size.toFixed(0)} — stop at support ${stop.toFixed(2)}, TP at resistance ${tp.toFixed(2)}, R:R ${rewardRisk.toFixed(2)}, ${regime.rationale}`
      : `sized down to $${size.toFixed(0)} from $${req.intendedSize.toFixed(0)} — ${clamp.clamped ? clamp.reason + "; " : ""}${regime.rationale}; stop ${stop.toFixed(2)}, TP ${tp.toFixed(2)}`;

  return {
    ...base.shell,
    size, stop, takeProfit: tp, rewardRisk,
    cmcLevels: base.cmcLevels,
    regimeK: regime.k,
    verdict, reason, degraded: false,
  };
}

function baseEnvelope(req: TradeRequest, entry: number, s: Signals, receipts: X402Receipt[]) {
  const isLong = req.side === "long";
  // long: stop = support below, TP = resistance above; short: mirror.
  const stop = isLong ? nearestBelow(s.support, entry) : nearestAbove(s.resistance, entry);
  const tpLevels = isLong ? s.resistance : s.support;
  const takeProfit = isLong ? nearestAbove(tpLevels, entry) : nearestBelow(tpLevels, entry);
  const cmcLevels = { support: stop ?? entry, resistance: takeProfit ?? entry };
  const shell = {
    token: req.token, side: req.side as Side, entryPrice: entry,
    regimeK: 1, receipts, cmcLevels,
  };
  return { stop, takeProfit, cmcLevels, shell };
}
