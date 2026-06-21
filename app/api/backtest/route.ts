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
  // [T0-2] Live recompute fallback (dev-only; the EARNED fixture above is bundled in prod). This branch
  // fetches Binance klines, which return HTTP 451 from Vercel's datacenter IPs — so it must NEVER bubble
  // an uncaught 500. Guard it: on any failure return a clean 503 rather than crashing the route.
  try {
    const trades = JSON.parse(readFileSync(join(process.cwd(), "fixtures", "trade-log-momentum.json"), "utf8")) as Trade[];
    const BAR_MS = 86_400_000; // 1d
    const start = Math.min(...trades.map((t) => t.entryTs)) - 70 * BAR_MS;
    const end = Math.max(...trades.map((t) => t.entryTs)) + 30 * BAR_MS;
    const klines = await getKlines("BNBUSDT", "1d", start, end);
    const state: PortfolioState = { equity: 10000, peakEquity: 10000, ddBudget: 0.3, currentDrawdown: 0 };
    const result = runAblation(trades, klines, state, { fearGreed: 72, altSeason: 65, globalLeverage: 68 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "backtest data unavailable" }, { status: 503 });
  }
}
