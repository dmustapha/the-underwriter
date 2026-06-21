// marketData — symbol mappings + the Bybit-primary / OKX-secondary / throw failover, and the
// newest-first -> oldest-first row reversal. fetch is stubbed so no network is touched.
import { describe, it, expect, vi, afterEach } from "vitest";
import { bybitSymbol, okxSymbol, getDailyKlinesLive } from "../src/clients/marketData";

afterEach(() => vi.unstubAllGlobals());

describe("bybitSymbol / okxSymbol mappings", () => {
  it("bybit maps all five demo tokens (incl CAKE)", () => {
    expect(bybitSymbol("BNB")).toBe("BNBUSDT");
    expect(bybitSymbol("CAKE")).toBe("CAKEUSDT");
    expect(bybitSymbol("BTC")).toBe("BTCUSDT");
    expect(bybitSymbol("ETH")).toBe("ETHUSDT");
    expect(bybitSymbol("SOL")).toBe("SOLUSDT");
  });
  it("bybit is case-insensitive, undefined for unsupported", () => {
    expect(bybitSymbol("bnb")).toBe("BNBUSDT");
    expect(bybitSymbol("DOGE")).toBeUndefined();
  });
  it("okx maps four tokens but NOT CAKE (no OKX listing)", () => {
    expect(okxSymbol("BNB")).toBe("BNB-USDT");
    expect(okxSymbol("BTC")).toBe("BTC-USDT");
    expect(okxSymbol("ETH")).toBe("ETH-USDT");
    expect(okxSymbol("SOL")).toBe("SOL-USDT");
    expect(okxSymbol("CAKE")).toBeUndefined();
  });
});

// Bybit returns NEWEST-FIRST rows: [startMs, open, high, low, close, volume, turnover].
const bybitBody = (list: string[][]) => ({ retCode: 0, result: { list } });
const okxBody = (list: string[][]) => ({ code: "0", data: list });
const okRes = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("getDailyKlinesLive — failover + parseRow reversal", () => {
  it("Bybit success -> returns OLDEST-FIRST (rows reversed from newest-first)", async () => {
    // newest-first: ts 2000 then 1000. Expect oldest-first output: 1000 then 2000.
    const list = [
      ["2000", "20", "25", "15", "22", "100", "x"],
      ["1000", "10", "12", "8", "11", "50", "x"],
    ];
    vi.stubGlobal("fetch", vi.fn(async () => okRes(bybitBody(list))));
    const out = await getDailyKlinesLive("BNB", 2);
    expect(out.map((k) => k.openTime)).toEqual([1000, 2000]); // reversed -> ascending time
    expect(out[0]).toMatchObject({ open: 10, high: 12, low: 8, close: 11, volume: 50 });
    expect(out[0].closeTime).toBe(1000 + 86_400_000 - 1); // derived +1d-1ms
  });

  it("Bybit retCode != 0 -> falls through to OKX, which returns", async () => {
    const okxList = [
      ["3000", "30", "33", "27", "31", "10", "vc", "vcq"],
      ["2000", "20", "22", "18", "21", "9", "vc", "vcq"],
    ];
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("bybit")
        ? okRes({ retCode: 1, result: { list: [] } }) // Bybit error code -> exhausts retries
        : okRes(okxBody(okxList))
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await getDailyKlinesLive("BNB", 2);
    expect(out.map((k) => k.openTime)).toEqual([2000, 3000]); // OKX reversed to ascending
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("okx"))).toBe(true);
  });

  it("Bybit + OKX both fail -> throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("bybit")
        ? okRes({ retCode: 1, result: { list: [] } })
        : okRes({ code: "50000", data: [] }) // OKX error code
    ));
    await expect(getDailyKlinesLive("BNB", 2)).rejects.toThrow(/Bybit \+ OKX unavailable/);
  });

  it("unsupported symbol (no Bybit, no OKX) -> throws before any fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getDailyKlinesLive("DOGE", 2)).rejects.toThrow(/unsupported symbol/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("CAKE has no OKX secondary: Bybit failure throws (no OKX attempt)", async () => {
    const fetchMock = vi.fn(async (_url?: unknown) => okRes({ retCode: 1, result: { list: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getDailyKlinesLive("CAKE", 2)).rejects.toThrow();
    // every call must have been to bybit — CAKE has no OKX instId
    expect(fetchMock.mock.calls.every((c) => String(c[0]).includes("bybit"))).toBe(true);
  });
});
