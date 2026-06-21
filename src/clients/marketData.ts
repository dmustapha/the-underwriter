// Live daily-kline source for the request path. Binance api.binance.com returns HTTP 451 from US
// clouds (Vercel iad1) so it is UNUSABLE on the deploy; Bybit v5 public market data is reachable and
// covers all five demo tokens. This client mirrors binanceClient's robustness (timeout + retries +
// hard throw on a bad shape) so the request path can compute CMC-method levels from real candles.
import { Kline } from "../types";

const BYBIT_KLINE = "https://api.bybit.com/v5/market/kline";

// CMC symbol -> Bybit spot symbol. Returns undefined for an unsupported symbol (caller rejects/falls
// back rather than silently mapping to the wrong market).
export function bybitSymbol(sym: string): string | undefined {
  const map: Record<string, string> = {
    BNB: "BNBUSDT",
    CAKE: "CAKEUSDT",
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
  };
  return map[sym?.toUpperCase()];
}

interface BybitKlineResponse {
  retCode: number;
  result?: { list?: string[][] };
}

// Bybit v5 returns NEWEST-FIRST rows of [startMs, open, high, low, close, volume, turnover] (strings).
function parseRow(row: string[]): Kline {
  const startMs = Number(row[0]);
  return {
    openTime: startMs,
    open: parseFloat(row[1]),
    high: parseFloat(row[2]),
    low: parseFloat(row[3]),
    close: parseFloat(row[4]),
    volume: parseFloat(row[5]),
    // Daily candle: close ~= next day open. No real closeTime field on Bybit; derive +1d-1ms.
    closeTime: startMs + 86_400_000 - 1,
  };
}

// Fetch `limit` daily candles for a CMC symbol, returned OLDEST-FIRST (reversed from Bybit's order).
// Throws on an unsupported symbol / network failure / retCode!=0 / empty list so the caller can fall
// back to the committed fixture instead of computing levels off a bad window.
export async function getDailyKlinesLive(symbol: string, limit = 90): Promise<Kline[]> {
  const bSym = bybitSymbol(symbol);
  if (!bSym) throw new Error(`getDailyKlinesLive: unsupported symbol ${symbol}`);
  const url = `${BYBIT_KLINE}?category=spot&symbol=${bSym}&interval=D&limit=${limit}`;

  // 3 attempts x 5s + backoff ≈ 16.5s worst case. Generous enough that a COLD serverless instance
  // (first Bybit connection from a fresh fra1 container can take >3s) still gets LIVE levels rather than
  // silently dropping to the fixture; bounded under the route's maxDuration=30 so a genuine Bybit outage
  // falls back to the fixture instead of a 504. Happy path on a warm instance is ~1s.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Bybit ${res.status}`);
      const body = (await res.json()) as BybitKlineResponse;
      if (body.retCode !== 0) throw new Error(`Bybit retCode ${body.retCode}`);
      const list = body.result?.list;
      if (!Array.isArray(list) || list.length === 0) throw new Error("Bybit empty list");
      // reverse NEWEST-FIRST -> OLDEST-FIRST, then map.
      return list.slice().reverse().map(parseRow);
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`getDailyKlinesLive failed for ${symbol}: ${String(lastErr)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
