import { Kline } from "../types";
import { BINANCE } from "../config";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), "fixtures", "klines");

function parseKline(row: (string | number)[]): Kline {
  return {
    openTime: Number(row[0]),
    open: parseFloat(String(row[1])),
    high: parseFloat(String(row[2])),
    low: parseFloat(String(row[3])),
    close: parseFloat(String(row[4])),
    volume: parseFloat(String(row[5])),
    closeTime: Number(row[6]),
  };
}

export async function getKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  limit = 1000
): Promise<Kline[]> {
  const key = `${symbol}-${interval}-${startTime}-${endTime}`;
  const cachePath = join(CACHE_DIR, `${key}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8")) as Kline[];
  }
  const url = `${BINANCE.klines}?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`Binance ${res.status}`);
      const rows = (await res.json()) as (string | number)[][];
      const klines = rows.map(parseKline);
      // Best-effort cache (DBG-007): read-only serverless fs must not fail the fetch.
      try {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(cachePath, JSON.stringify(klines, null, 2));
      } catch { /* read-only fs — return the data without caching */ }
      return klines;
    } catch (e) {
      lastErr = e;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`getKlines failed for ${symbol}: ${String(lastErr)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
