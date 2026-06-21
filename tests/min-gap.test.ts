// MIN_GAP hygiene on the TA fixture-fallback path. When an entryHint lands ~on a frozen fixture level,
// that level must be DROPPED (>=0.5% gap required) so the engine can never receive a hairline stop that
// fabricates an absurd reward:risk. We force the fixture-fallback branch by failing Bybit + OKX.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Mod = typeof import("../src/clients/cmcClient");

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  delete process.env.X402_PRIVATE_KEY;
  delete process.env.CMC_PRO_API_KEY;
});

// Both venues fail -> getDailyKlinesLive throws -> getTechnicalAnalysisLive hits the fixture fallback.
const failAll = vi.fn(async (url: string) =>
  url.includes("bybit")
    ? ({ ok: true, status: 200, json: async () => ({ retCode: 1, result: { list: [] } }) } as unknown as Response)
    : ({ ok: true, status: 200, json: async () => ({ code: "50000", data: [] }) } as unknown as Response)
);

async function load(): Promise<Mod> {
  vi.stubGlobal("fetch", failAll);
  return (await import("../src/clients/cmcClient")) as Mod;
}

describe("getTechnicalAnalysisLive — fixture-fallback MIN_GAP filter", () => {
  it("drops a fixture support level coincident with the entryHint (no hairline stop)", async () => {
    const mod = await load();
    // 612.2733333333333 IS a committed support level in fixtures/cmc/ta-bnb.json.
    const entryHint = 612.2733333333333;
    const r = await mod.cmcClient.getTechnicalAnalysisLive("BNB", entryHint);

    expect(r.levelsSource).toBe("fixture"); // proved we took the fallback branch
    const support = (r.data as { support_levels: number[] }).support_levels;

    // the coincident level is gone (within 0.5% of entry)
    expect(support).not.toContain(entryHint);
    // every surviving support is a MEANINGFUL distance (>=0.5%) below entry — no hairline stop
    const gap = entryHint * 0.005;
    for (const x of support) expect(entryHint - x).toBeGreaterThanOrEqual(gap);
    // the next real support (607.30...) survives, so levels are not empty / not falsely degraded
    expect(support).toContain(607.3066666666666);
    expect(r.degraded).toBe(false);
  });

  it("filtered levels feed a disciplined stop, not a 0.2%-away hairline", async () => {
    const mod = await load();
    const entryHint = 612.2733333333333;
    const r = await mod.cmcClient.getTechnicalAnalysisLive("BNB", entryHint);
    const support = (r.data as { support_levels: number[] }).support_levels;
    const nearestBelow = Math.max(...support.filter((x) => x < entryHint));
    const stopDistPct = (entryHint - nearestBelow) / entryHint;
    expect(stopDistPct).toBeGreaterThanOrEqual(0.005); // stop sits a real distance off entry
  });
});
