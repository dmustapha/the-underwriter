// Live daily-kline source for the request path. Binance api.binance.com returns HTTP 451 from US
// clouds (Vercel iad1) so it is UNUSABLE on the deploy. Primary source is Bybit v5 (reachable, covers
// all five demo tokens incl CAKE); OKX is a secondary failover (no CAKE) so a Bybit outage/region-block
// doesn't silently drop every request to the frozen fixture. The caller computes CMC-method levels from
// whichever real candles come back, and falls back to the committed fixture only if BOTH sources fail.
import { Kline } from "../types";

const BYBIT_KLINE = "https://api.bybit.com/v5/market/kline";
const OKX_KLINE = "https://www.okx.com/api/v5/market/candles";

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

// CMC symbol -> OKX instId. OKX does NOT list CAKE, so CAKE has no secondary (Bybit-or-fixture only).
export function okxSymbol(sym: string): string | undefined {
  const map: Record<string, string> = {
    BNB: "BNB-USDT",
    BTC: "BTC-USDT",
    ETH: "ETH-USDT",
    SOL: "SOL-USDT",
  };
  return map[sym?.toUpperCase()];
}

interface BybitKlineResponse { retCode: number; result?: { list?: string[][] }; }
interface OkxKlineResponse { code: string; data?: string[][]; }

// Both venues return NEWEST-FIRST rows whose first 5 cols are [startMs, open, high, low, close]
// (OKX adds volume variants after; Bybit is [..., volume, turnover]). col 5 is a volume in both.
function parseRow(row: string[]): Kline {
  const startMs = Number(row[0]);
  return {
    openTime: startMs,
    open: parseFloat(row[1]),
    high: parseFloat(row[2]),
    low: parseFloat(row[3]),
    close: parseFloat(row[4]),
    volume: parseFloat(row[5]),
    // Daily candle: no real closeTime field; derive +1d-1ms.
    closeTime: startMs + 86_400_000 - 1,
  };
}

// Bybit: 3 attempts x 5s + backoff (~16.5s) — generous so a COLD serverless instance still gets LIVE
// levels. Returns null (not throw) on exhaustion so the caller can try the secondary.
async function tryBybit(bSym: string, limit: number): Promise<Kline[] | null> {
  const url = `${BYBIT_KLINE}?category=spot&symbol=${bSym}&interval=D&limit=${limit}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Bybit ${res.status}`);
      const body = (await res.json()) as BybitKlineResponse;
      if (body.retCode !== 0) throw new Error(`Bybit retCode ${body.retCode}`);
      const list = body.result?.list;
      if (!Array.isArray(list) || list.length === 0) throw new Error("Bybit empty list");
      return list.slice().reverse().map(parseRow); // NEWEST-FIRST -> OLDEST-FIRST
    } catch {
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }
  return null;
}

// OKX secondary: single 4s attempt (fast insurance, not a full retry budget). Returns null on failure.
async function tryOkx(oSym: string, limit: number): Promise<Kline[] | null> {
  const url = `${OKX_KLINE}?instId=${oSym}&bar=1D&limit=${limit}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const body = (await res.json()) as OkxKlineResponse;
    if (body.code !== "0") return null;
    const list = body.data;
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.slice().reverse().map(parseRow); // NEWEST-FIRST -> OLDEST-FIRST
  } catch {
    return null;
  }
}

// Fetch `limit` daily candles for a CMC symbol, OLDEST-FIRST. Tries Bybit, then OKX (if listed), then
// throws so the caller falls back to the committed fixture. Total worst case (~20.5s) stays under the
// route's maxDuration=30.
export async function getDailyKlinesLive(symbol: string, limit = 90): Promise<Kline[]> {
  const bSym = bybitSymbol(symbol);
  const oSym = okxSymbol(symbol);
  if (!bSym && !oSym) throw new Error(`getDailyKlinesLive: unsupported symbol ${symbol}`);

  if (bSym) {
    const r = await tryBybit(bSym, limit);
    if (r) return r;
  }
  if (oSym) {
    const r = await tryOkx(oSym, limit);
    if (r) return r;
  }
  throw new Error(`getDailyKlinesLive failed for ${symbol} (Bybit + OKX unavailable)`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
