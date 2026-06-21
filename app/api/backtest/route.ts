import { NextRequest, NextResponse } from "next/server";
import { getKlines } from "../../../src/clients/binanceClient";
import { runAblation } from "../../../src/backtest/ablation";
import { Trade, PortfolioState, AblationResult } from "../../../src/types";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  // serve the EARNED pre-computed ablation if present (instant, demo-safe).
  const cached = join(process.cwd(), "fixtures", "ablation.json");
  if (existsSync(cached)) {
    return NextResponse.json(JSON.parse(readFileSync(cached, "utf8")) as AblationResult);
  }
  // otherwise compute live from cached klines + trade log (daily window — matches seed/CLI, DEV-005).
  const trades = JSON.parse(readFileSync(join(process.cwd(), "fixtures", "trade-log-momentum.json"), "utf8")) as Trade[];
  const BAR_MS = 86_400_000; // 1d
  const start = Math.min(...trades.map((t) => t.entryTs)) - 70 * BAR_MS;
  const end = Math.max(...trades.map((t) => t.entryTs)) + 30 * BAR_MS;
  const klines = await getKlines("BNBUSDT", "1d", start, end);
  const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
  const result = runAblation(trades, klines, state, { fearGreed: 72, altSeason: 65, globalLeverage: 68 });
  return NextResponse.json(result);
}
