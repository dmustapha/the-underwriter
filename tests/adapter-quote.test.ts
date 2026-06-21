// quotePriceFromX402 — resolves the live entry price from the loose beta CMC quotes shape. Must accept
// both the keyed-by-id object and array forms, both quote.USD.price and quote[0].price, and reject junk
// (null/zero/negative/empty) by returning undefined so the caller falls through to the next entry source.
import { describe, it, expect } from "vitest";
import { quotePriceFromX402 } from "../src/clients/cmcAdapter";

describe("quotePriceFromX402 — shape resolution", () => {
  it("keyed-by-id object with quote.USD.price -> price", () => {
    const raw = { data: { "1839": { quote: { USD: { price: 612.34 } } } } };
    expect(quotePriceFromX402(raw)).toBeCloseTo(612.34, 6);
  });
  it("array data with quote.USD.price -> price", () => {
    const raw = { data: [{ quote: { USD: { price: 555.5 } } }] };
    expect(quotePriceFromX402(raw)).toBeCloseTo(555.5, 6);
  });
  it("array quote shape (quote[0].price) -> price", () => {
    const raw = { data: { "1": { quote: [{ price: 42000 }] } } };
    expect(quotePriceFromX402(raw)).toBeCloseTo(42000, 6);
  });
  it("resolves the first positive entry, skipping junk earlier in the list", () => {
    const raw = { data: { a: { quote: { USD: { price: 0 } } }, b: { quote: { USD: { price: 99 } } } } };
    expect(quotePriceFromX402(raw)).toBeCloseTo(99, 6);
  });
});

describe("quotePriceFromX402 — junk rejection (undefined)", () => {
  it("price 0 -> undefined", () => {
    expect(quotePriceFromX402({ data: { "1": { quote: { USD: { price: 0 } } } } })).toBeUndefined();
  });
  it("price null -> undefined", () => {
    expect(quotePriceFromX402({ data: { "1": { quote: { USD: { price: null } } } } })).toBeUndefined();
  });
  it("negative price -> undefined", () => {
    expect(quotePriceFromX402({ data: { "1": { quote: { USD: { price: -5 } } } } })).toBeUndefined();
  });
  it("empty data object -> undefined", () => {
    expect(quotePriceFromX402({ data: {} })).toBeUndefined();
  });
  it("empty data array -> undefined", () => {
    expect(quotePriceFromX402({ data: [] })).toBeUndefined();
  });
  it("missing data -> undefined", () => {
    expect(quotePriceFromX402({})).toBeUndefined();
  });
  it("non-object data -> undefined", () => {
    expect(quotePriceFromX402({ data: 123 })).toBeUndefined();
  });
});
