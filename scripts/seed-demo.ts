// Capture CMC fixtures + Binance klines + EARN one real ablation. Run: pnpm seed
//
// Demo stress scenario = the 2022 BNB bear (real Binance daily klines). At EQUAL average
// exposure the underwriter cuts the naive momentum agent's realized drawdown several-fold
// and lifts its Calmar above what a flat size cut can reach (flat-haircut Calmar == raw
// Calmar by scale-invariance). Daily bars are used because the engine's level-based stops
// on 1h bars sit ~0.3% from entry — too tight to put meaningful capital at risk (DEV-005).
import { cmcClient } from "../src/clients/cmcClient";
import { getKlines } from "../src/clients/binanceClient";
import { runAblation } from "../src/backtest/ablation";
import { rsi, computeLevels } from "../src/engine/indicators";
import { Trade, PortfolioState, Kline } from "../src/types";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FIX = join(process.cwd(), "fixtures");

// Build a CMC-shaped technical-analysis fixture from REAL recent klines via the engine's
// closed-form levels. Used by the LIVE /api/underwrite path when no CMC MCP key is available
// (PLAN Task 1.3 fallback) — levels are computed the SAME way as the backtest, so the demo
// stays self-consistent and EARNED (concern [C]#5). Tagged so it's never mistaken for live CMC.
async function writeTaFixture(symbol: string, fileKey: string): Promise<void> {
  const klines = await getKlines(symbol, "1d", Date.parse("2026-02-01T00:00:00Z"), Date.parse("2026-06-15T00:00:00Z"));
  if (klines.length < 61) return;
  const entry = klines[klines.length - 1].close;
  const window = klines.slice(0, klines.length - 1);
  const lv = computeLevels(window, entry);
  writeFileSync(join(FIX, "cmc", `${fileKey}.json`), JSON.stringify({
    _source: "closed-form-fallback (real Binance klines; no CMC MCP key — PLAN Task 1.3 fallback)",
    entry,
    support_levels: lv.support,
    resistance_levels: lv.resistance,
    fibonacci: lv.fib,
    rsi: lv.rsi,
  }, null, 2));
}

// Demo configuration (locked at the Day-2 GO/NO-GO gate).
const SYMBOL = "BNBUSDT";
const INTERVAL = "1d";
const BAR_MS = 86_400_000;
const NAIVE_SIZE = 12_000;           // a reckless momentum agent over-deploys (~1.2x equity)
const FEAR_GREED = 72;               // demo regime snapshot (greedy/frothy) -> gate sizes down
const SCAN_START = "2021-10-01";     // generous warmup so every 2022 entry has >=60 prior bars
const SCAN_END = "2022-12-31";

// [CRITIQUE E-3] EMA / MACD for the named "RSI + MACD + Fear&Greed momentum skill".
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1); const out: number[] = []; let prev = values[0];
  for (let i = 0; i < values.length; i++) { prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k); out.push(prev); }
  return out;
}
function macd(closes: number[]): { line: number[]; signal: number[] } {
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const line = closes.map((_, i) => e12[i] - e26[i]);
  return { line, signal: ema(line, 9) };
}

// [CRITIQUE E-3] Generate the competitor-style momentum trade log: long entries when RSI
// crosses up through 50 AND MACD is above its signal AND F&G is greedy (>=50). This is the
// kind of signal skill ~3 other Track-2 teams ship — The Underwriter underwrites it.
function momentumTradeLog(klines: Kline[], fearGreed: number, size: number): Trade[] {
  const closes = klines.map((k) => k.close);
  const { line, signal } = macd(closes);
  const trades: Trade[] = [];
  let last = -999; const gap = 6, forward = 30; const fgGate = fearGreed >= 50;
  // scan from 60 so every entry has the full 60-bar Fibonacci lookback available
  for (let i = 60; i < klines.length - forward; i++) {
    const rsiPrev = rsi(closes.slice(0, i));
    const rsiNow = rsi(closes.slice(0, i + 1));
    if (rsiPrev < 50 && rsiNow >= 50 && line[i] > signal[i] && fgGate && i - last >= gap) {
      trades.push({ token: "BNB", side: "long", entryTs: klines[i].openTime, entryPrice: klines[i].close, intendedSize: size });
      last = i;
    }
  }
  return trades;
}

async function main(): Promise<void> {
  mkdirSync(FIX, { recursive: true });
  mkdirSync(join(FIX, "cmc"), { recursive: true });

  // 0) live-underwrite TA fixtures (closed-form fallback from real klines — see writeTaFixture).
  await writeTaFixture("BNBUSDT", "ta-bnb");
  await writeTaFixture("CAKEUSDT", "ta-cake");

  // 1) capture regime fixtures (lands x402 receipts if X402_PRIVATE_KEY is funded; else cache).
  const fg = await cmcClient.getFearGreed();
  await cmcClient.getAltSeason();
  await cmcClient.getGlobalMetrics();

  // 2) discover momentum entries over a generous warmup window.
  const scanKlines = await getKlines(SYMBOL, INTERVAL, Date.parse(SCAN_START + "T00:00:00Z"), Date.parse(SCAN_END + "T00:00:00Z"));
  const trades = momentumTradeLog(scanKlines, FEAR_GREED, NAIVE_SIZE);
  if (trades.length < 4) throw new Error(`momentum log too small (${trades.length}); widen SCAN window`);

  // 3) EARN the ablation on the canonical range (70 bars back / 30 forward) — the SAME range
  //    the CLI re-derives, so `pnpm backtest` reproduces ablation.json exactly.
  const start = Math.min(...trades.map((t) => t.entryTs)) - 70 * BAR_MS;
  const end = Math.max(...trades.map((t) => t.entryTs)) + 30 * BAR_MS;
  const klines = await getKlines(SYMBOL, INTERVAL, start, end);

  const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
  const regimeSnap = { fearGreed: FEAR_GREED, altSeason: 65, globalLeverage: 68 };
  const result = runAblation(trades, klines, state, regimeSnap);

  // 4) persist the trade log (both the named E-3 file and the plan's generic path) + ablation.
  writeFileSync(join(FIX, "trade-log-momentum.json"), JSON.stringify(trades, null, 2));
  writeFileSync(join(FIX, "trade-log.json"), JSON.stringify(trades, null, 2));
  writeFileSync(join(FIX, "ablation.json"), JSON.stringify(result, null, 2));

  const raw = result.arms.find((a) => a.arm === "raw")!;
  const fh = result.arms.find((a) => a.arm === "flatHaircut")!;
  const fgArm = result.arms.find((a) => a.arm === "fullGate")!;
  console.log(`fixtures: F&G source=${fg.source}; momentum trades=${trades.length}; window ${SYMBOL} ${INTERVAL} ${SCAN_START}..${SCAN_END}`);
  console.log(
    `seed complete. EARNED ablation (equal exposure raw ${raw.avgExposure.toFixed(2)} / fullGate ${fgArm.avgExposure.toFixed(2)}):\n` +
    `  raw         ret ${(raw.totalReturn * 100).toFixed(1)}%  maxDD ${(raw.maxDrawdown * 100).toFixed(1)}%  Calmar ${raw.calmar.toFixed(2)}\n` +
    `  flatHaircut ret ${(fh.totalReturn * 100).toFixed(1)}%  maxDD ${(fh.maxDrawdown * 100).toFixed(1)}%  Calmar ${fh.calmar.toFixed(2)}\n` +
    `  fullGate    ret ${(fgArm.totalReturn * 100).toFixed(1)}%  maxDD ${(fgArm.maxDrawdown * 100).toFixed(1)}%  Calmar ${fgArm.calmar.toFixed(2)}  declined ${result.declined.length}`
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
