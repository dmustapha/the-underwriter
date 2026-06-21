// PHASE B (CR-2) — verify the cmcAdapter maps the REAL live CMC field names. These response shapes
// are copied verbatim from live calls on 2026-06-19 (key validated). Catches the silent-default bug
// where alt-season mapped to 50 because the candidate paths missed `data.altcoin_index`.
import { describe, it, expect } from "vitest";
import { fearGreedValue, altSeasonValue, globalRiskFromMetrics } from "../src/clients/cmcAdapter";

describe("CR-2 live CMC field mapping", () => {
  it("fearGreedValue maps /v3/fear-and-greed/latest -> data.value (19)", () => {
    const live = { status: { error_code: 0 }, data: { value: 19, value_classification: "Extreme fear" } };
    expect(fearGreedValue(live)).toBe(19);
  });

  it("altSeasonValue maps /v1/altcoin-season-index/latest -> data.altcoin_index (46)", () => {
    const live = { status: { error_code: 0 }, data: { altcoin_index: 46, altcoin_marketcap: 9e11 } };
    expect(altSeasonValue(live)).toBe(46); // was defaulting to 50 before the path fix
  });

  it("altSeasonValue stays backward-compatible with the legacy altcoin_season path", () => {
    expect(altSeasonValue({ data: { altcoin_season: 65 } })).toBe(65);
  });

  it("globalRiskFromMetrics derives froth proxy = 100 - btc_dominance (58.13 -> 41.87)", () => {
    const live = { status: { error_code: 0 }, data: { btc_dominance: 58.129046435795, eth_dominance: 9.48 } };
    expect(globalRiskFromMetrics(live)).toBeCloseTo(41.870953, 4);
  });

  it("globalRiskFromMetrics returns undefined when dominance is absent (no fabricated constant)", () => {
    expect(globalRiskFromMetrics({})).toBeUndefined();
    expect(globalRiskFromMetrics({ data: {} })).toBeUndefined();
  });
});
