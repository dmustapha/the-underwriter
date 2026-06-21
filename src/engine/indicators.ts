import { Kline, FibLevel, Signals } from "../types";
import { INDI } from "../config";

// Classic floor-trader pivots from the most recent completed bar.
export function pivots(prev: Kline): { p: number; r1: number; r2: number; s1: number; s2: number } {
  const p = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * p - prev.low;
  const s1 = 2 * p - prev.high;
  const r2 = p + (prev.high - prev.low);
  const s2 = p - (prev.high - prev.low);
  return { p, r1, r2, s1, s2 };
}

// Fibonacci retracement levels from the swing high/low over a lookback window.
export function fibLevels(window: Kline[]): FibLevel[] {
  const hi = Math.max(...window.map((k) => k.high));
  const lo = Math.min(...window.map((k) => k.low));
  const range = hi - lo;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  // measured from the low up (retracements of an up-leg)
  return ratios.map((ratio) => ({ ratio, price: lo + range * ratio }));
}

export function rsi(closes: number[], period = INDI.rsiPeriod): number {
  if (closes.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  if (loss === 0) return 100;
  const rs = gain / period / (loss / period);
  return 100 - 100 / (1 + rs);
}

// Build the support/resistance arrays (ascending) from pivots + fib at a given bar index.
// `window` ends at the bar BEFORE entry; `entryPrice` is the entry close.
export function computeLevels(window: Kline[], entryPrice: number): { support: number[]; resistance: number[]; fib: FibLevel[]; rsi: number } {
  const lookback = window.slice(-INDI.fibLookback);
  const prev = window[window.length - 1];
  const pv = pivots(prev);
  const fib = fibLevels(lookback);
  const all = [pv.s2, pv.s1, pv.p, pv.r1, pv.r2, ...fib.map((f) => f.price)];
  const support = all.filter((x) => x < entryPrice).sort((a, b) => a - b);
  const resistance = all.filter((x) => x > entryPrice).sort((a, b) => a - b);
  return { support, resistance, fib, rsi: rsi(window.map((k) => k.close)) };
}

// Assemble a backtest Signals object (regime fields filled by the caller from snapshots/neutral).
export function signalsFromOHLCV(
  window: Kline[],
  entryPrice: number,
  regime: { fearGreed: number; altSeason: number; globalLeverage?: number }
): Signals {
  const lv = computeLevels(window, entryPrice);
  return {
    entryPrice,
    support: lv.support,
    resistance: lv.resistance,
    fib: lv.fib,
    rsi: lv.rsi,
    fearGreed: regime.fearGreed,
    altSeason: regime.altSeason,
    globalLeverage: regime.globalLeverage,
    degraded: lv.support.length === 0 || lv.resistance.length === 0,
  };
}
