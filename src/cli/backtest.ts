import { getKlines } from "../clients/binanceClient";
import { runAblation } from "../backtest/ablation";
import { Trade, PortfolioState } from "../types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Usage: tsx src/cli/backtest.ts <tradeLogPath> <symbol> <interval>
async function main(): Promise<void> {
  const [logPath, symbol = "BNBUSDT", interval = "1h"] = process.argv.slice(2);
  if (!logPath) throw new Error("usage: tsx src/cli/backtest.ts <tradeLogPath> [symbol] [interval]");

  const trades = JSON.parse(readFileSync(join(process.cwd(), logPath), "utf8")) as Trade[];
  // Interval-aware warmup: the engine's Fibonacci/level lookback needs ~60 bars BEFORE each
  // entry, so the lookback must scale with the bar size (5 calendar days = 5 daily bars,
  // not enough). 70 bars back / 30 forward guarantees seed and CLI fetch identical klines.
  const barMs = interval === "1d" ? 86_400_000 : interval === "4h" ? 4 * 3_600_000 : interval === "15m" ? 15 * 60_000 : 3_600_000;
  const start = Math.min(...trades.map((t) => t.entryTs)) - 70 * barMs;
  const end = Math.max(...trades.map((t) => t.entryTs)) + 30 * barMs;

  const klines = await getKlines(symbol, interval, start, end);
  const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
  const regimeSnap = { fearGreed: 72, altSeason: 65, globalLeverage: 68 };

  const result = runAblation(trades, klines, state, regimeSnap);
  for (const arm of result.arms) {
    console.log(
      `${arm.arm.padEnd(12)} return ${(arm.totalReturn * 100).toFixed(1)}%  maxDD ${(arm.maxDrawdown * 100).toFixed(1)}%  Calmar ${arm.calmar.toFixed(2)}  winRate ${(arm.winRate * 100).toFixed(0)}%  avgExp ${arm.avgExposure.toFixed(2)}  trades ${arm.tradeCount}  excluded ${arm.excludedTrades}`
    );
  }
  console.log(`haircut constant (equal-exposure): ${result.haircutConstant.toFixed(3)}`);
  const fg = result.arms.find((a) => a.arm === "fullGate")!;
  const fh = result.arms.find((a) => a.arm === "flatHaircut")!;
  const verdict = fg.calmar > fh.calmar ? "GO — full gate beats flat haircut at equal exposure" : "NO-GO — switch to backup (Budgeted Decisioner)";
  console.log(`\nDAY-2 GATE: ${verdict} (fullGate Calmar ${fg.calmar.toFixed(2)} vs flatHaircut ${fh.calmar.toFixed(2)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
