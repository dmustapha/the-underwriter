// Reusable momentum signal generator — the "competitor-style" RSI + MACD + Fear&Greed skill that
// The Underwriter underwrites. Extracted verbatim from scripts/seed-demo.ts (Fix 1) so it can be
// reused by the multi-window ablation (Fix 2) and the agent-loop example (Fix 4) without dragging
// in the seed script. Behaviour is byte-identical to the original; see tests/signals-momentum.test.ts.
import { rsi } from "../engine/indicators";
import { Trade, Kline } from "../types";

// Exponential moving average over a series (Wilder-free, standard 2/(n+1) smoothing).
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// MACD line (EMA12 - EMA26) and its 9-period signal line.
export function macd(closes: number[]): { line: number[]; signal: number[] } {
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const line = closes.map((_, i) => e12[i] - e26[i]);
  return { line, signal: ema(line, 9) };
}

export interface MomentumParams {
  gap?: number;     // min bars between entries (anti-clustering)
  forward?: number; // bars reserved after the last entry for the hold window
  warmup?: number;  // first bar eligible to enter (>= fib lookback)
}

// Long entries when RSI crosses up through 50 AND MACD is above its signal AND Fear&Greed is
// greedy (>=50). `token` is now a parameter (was hardcoded "BNB") so the same generator drives
// the multi-asset ablation. Defaults reproduce the original BNB demo log exactly.
export function momentumTradeLog(
  klines: Kline[],
  fearGreed: number,
  size: number,
  token = "BNB",
  params: MomentumParams = {},
): Trade[] {
  const { gap = 6, forward = 30, warmup = 60 } = params;
  const closes = klines.map((k) => k.close);
  const { line, signal } = macd(closes);
  const trades: Trade[] = [];
  let last = -999;
  const fgGate = fearGreed >= 50;
  // scan from `warmup` so every entry has the full Fibonacci lookback available
  for (let i = warmup; i < klines.length - forward; i++) {
    const rsiPrev = rsi(closes.slice(0, i));
    const rsiNow = rsi(closes.slice(0, i + 1));
    if (rsiPrev < 50 && rsiNow >= 50 && line[i] > signal[i] && fgGate && i - last >= gap) {
      trades.push({ token, side: "long", entryTs: klines[i].openTime, entryPrice: klines[i].close, intendedSize: size });
      last = i;
    }
  }
  return trades;
}
