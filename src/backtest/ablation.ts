import { Kline, Trade, ArmName, ArmResult, AblationResult, PortfolioState, Signals } from "../types";
import { signalsFromOHLCV } from "../engine/indicators";
import { underwrite } from "../engine/envelope";

export interface Execution { entryIndex: number; entry: number; stop: number; tp: number; notional: number; side: "long" | "short"; }

// Walk forward from entry until stop or TP is touched; return realized PnL fraction of notional.
// Exported for independent oracle testing (tests/debug-oracle-ablation.test.ts) — no behavior change.
export function realizeTrade(klines: Kline[], ex: Execution): number {
  const units = ex.notional / ex.entry;
  for (let i = ex.entryIndex + 1; i < klines.length; i++) {
    const k = klines[i];
    if (ex.side === "long") {
      if (k.low <= ex.stop) return units * (ex.stop - ex.entry);
      if (k.high >= ex.tp) return units * (ex.tp - ex.entry);
    } else {
      if (k.high >= ex.stop) return units * (ex.entry - ex.stop);
      if (k.low <= ex.tp) return units * (ex.entry - ex.tp);
    }
  }
  // Unresolved at series end: mark-to-last-close.
  const last = klines[klines.length - 1].close;
  return ex.side === "long" ? units * (last - ex.entry) : units * (ex.entry - last);
}

function indexAtOrAfter(klines: Kline[], ts: number): number {
  for (let i = 0; i < klines.length; i++) if (klines[i].openTime >= ts) return i;
  return -1;
}

// Build executions for one arm.
function buildExecutions(
  trades: Trade[],
  klines: Kline[],
  state: PortfolioState,
  mode: ArmName,
  regimeSnap: { fearGreed: number; altSeason: number; globalLeverage?: number },
  haircut = 1
): { execs: Execution[]; declined: Trade[] } {
  const execs: Execution[] = [];
  const declined: Trade[] = [];
  for (const t of trades) {
    const idx = indexAtOrAfter(klines, t.entryTs);
    if (idx < 2) continue;
    const window = klines.slice(0, idx); // bars strictly before entry
    if (mode === "raw") {
      // raw: arbitrary fixed stop/TP from the same levels but full intended size, no gating
      const s = signalsFromOHLCV(window, t.entryPrice, regimeSnap);
      const stop = pick(s, t.side, "stop");
      const tp = pick(s, t.side, "tp");
      if (stop === undefined || tp === undefined) continue;
      execs.push({ entryIndex: idx, entry: t.entryPrice, stop, tp, notional: t.intendedSize, side: t.side });
    } else if (mode === "flatHaircut") {
      const s = signalsFromOHLCV(window, t.entryPrice, regimeSnap);
      const stop = pick(s, t.side, "stop");
      const tp = pick(s, t.side, "tp");
      if (stop === undefined || tp === undefined) continue;
      execs.push({ entryIndex: idx, entry: t.entryPrice, stop, tp, notional: t.intendedSize * haircut, side: t.side });
    } else {
      // fullGate: pass through the engine; DECLINE -> excluded from the log
      const s: Signals = signalsFromOHLCV(window, t.entryPrice, regimeSnap);
      const env = underwrite({ token: t.token, side: t.side, intendedSize: t.intendedSize }, s, state);
      if (env.verdict === "DECLINE") { declined.push(t); continue; }
      execs.push({ entryIndex: idx, entry: t.entryPrice, stop: env.stop, tp: env.takeProfit, notional: env.size, side: t.side });
    }
  }
  return { execs, declined };
}

function pick(s: Signals, side: "long" | "short", which: "stop" | "tp"): number | undefined {
  const isLong = side === "long";
  const below = s.support.filter((x) => x < s.entryPrice);
  const above = s.resistance.filter((x) => x > s.entryPrice);
  if (which === "stop") return isLong ? (below.length ? Math.max(...below) : undefined) : (above.length ? Math.min(...above) : undefined);
  return isLong ? (above.length ? Math.min(...above) : undefined) : (below.length ? Math.max(...below) : undefined);
}

// Simulate equity curve + metrics for a set of executions.
// Exported for independent oracle testing — no behavior change.
export function simulate(execs: Execution[], klines: Kline[], startEquity: number): { result: Omit<ArmResult, "arm" | "excludedTrades">; curve: number[] } {
  let equity = startEquity;
  let peak = startEquity;
  let maxDD = 0;
  let wins = 0;
  const curve: number[] = [startEquity];
  let exposureSum = 0;
  // chronological order
  const ordered = [...execs].sort((a, b) => a.entryIndex - b.entryIndex);
  for (const ex of ordered) {
    exposureSum += ex.notional / equity;
    const pnl = realizeTrade(klines, ex);
    if (pnl > 0) wins++;
    equity += pnl;
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, (peak - equity) / peak);
    curve.push(equity);
  }
  const n = ordered.length || 1;
  const totalReturn = (equity - startEquity) / startEquity;
  const avgExposure = exposureSum / n;
  const calmar = maxDD > 0 ? totalReturn / maxDD : totalReturn > 0 ? Infinity : 0;
  return {
    result: { totalReturn, maxDrawdown: maxDD, calmar, winRate: ordered.length ? wins / ordered.length : 0, avgExposure, tradeCount: ordered.length },
    curve,
  };
}

export function runAblation(
  trades: Trade[],
  klines: Kline[],
  state: PortfolioState,
  regimeSnap: { fearGreed: number; altSeason: number; globalLeverage?: number }
): AblationResult {
  const startEquity = state.equity;

  // 1) fullGate first — it determines the target average exposure.
  const fg = buildExecutions(trades, klines, state, "fullGate", regimeSnap);
  const fgSim = simulate(fg.execs, klines, startEquity);

  // 2) raw arm.
  const raw = buildExecutions(trades, klines, state, "raw", regimeSnap);
  const rawSim = simulate(raw.execs, klines, startEquity);

  // 3) equal-exposure flat haircut: solve c so flatHaircut avgExposure == fullGate avgExposure.
  //    avgExposure scales linearly with notional, so c = fgAvgExposure / rawAvgExposure.
  const c = rawSim.result.avgExposure > 0 ? fgSim.result.avgExposure / rawSim.result.avgExposure : 1;
  const fh = buildExecutions(trades, klines, state, "flatHaircut", regimeSnap, c);
  const fhSim = simulate(fh.execs, klines, startEquity);

  const arms: ArmResult[] = [
    { arm: "raw", ...rawSim.result, excludedTrades: 0 },
    { arm: "flatHaircut", ...fhSim.result, excludedTrades: 0 },
    { arm: "fullGate", ...fgSim.result, excludedTrades: fg.declined.length },
  ];

  return {
    arms,
    equityCurves: { raw: rawSim.curve, flatHaircut: fhSim.curve, fullGate: fgSim.curve },
    declined: fg.declined,
    haircutConstant: c,
  };
}
