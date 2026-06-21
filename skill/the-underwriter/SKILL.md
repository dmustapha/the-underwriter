---
name: the-underwriter
description: |
  Risk-underwrites a proposed crypto trade into a full risk envelope (position size, stop-loss, take-profit, reward:risk, and a drawdown-budget verdict) using CoinMarketCap data.
  Use when an agent or trader has a trade idea {token, side, intended size} and needs a disciplined size + stop + take-profit before acting, or wants to keep a portfolio under a max-drawdown limit.
  Trigger: "underwrite this trade", "how big should this position be", "risk envelope", "where's my stop", "keep me under max drawdown", "/the-underwriter"
license: MIT
compatibility: ">=1.0.0"
user-invocable: true
allowed-tools:
  - mcp__cmc-mcp__search_cryptos
  - mcp__cmc-mcp__get_crypto_quotes_latest
  - mcp__cmc-mcp__get_crypto_technical_analysis
  - mcp__cmc-mcp__get_global_metrics_latest
  - mcp__cmc-mcp__get_global_crypto_derivatives_metrics
---

# The Underwriter Skill

Turns a proposed trade into a complete, CMC-driven risk envelope and keeps a trading agent under its max-drawdown limit.

## Prerequisites

Register the CoinMarketCap MCP server:

```json
{ "mcpServers": { "cmc-mcp": { "url": "https://mcp.coinmarketcap.com/mcp", "headers": { "X-CMC-MCP-API-KEY": "your-api-key" } } } }
```

Get an API key from https://pro.coinmarketcap.com/login. For keyless pay-per-call data, use the CMC x402 surface (`@x402/fetch` + a funded Base USDC wallet).

## Core Principle

A signal tells you WHAT to trade. The Underwriter tells you WHETHER to take it and HOW BIG. The stop and take-profit are read from CoinMarketCap's support/resistance and Fibonacci levels — they are never invented. A trade that fails the reward:risk bar is DECLINED (excluded), not silently shrunk.

## Workflow

### Step 1 — Resolve the token
Call `mcp__cmc-mcp__search_cryptos` with the symbol to get the CMC id. Then `mcp__cmc-mcp__get_crypto_quotes_latest` for the live entry price.

### Step 2 — Read the technical levels (stop + take-profit)
Call `mcp__cmc-mcp__get_crypto_technical_analysis`. Extract: support levels, resistance levels, Fibonacci levels, RSI, pivots.
- Long: stop = nearest support below entry; take-profit = nearest resistance/Fibonacci above entry.
- Short: mirror.

### Step 3 — Read the market regime (sizing multiplier)
Call `mcp__cmc-mcp__get_global_metrics_latest` (Fear & Greed, altcoin-season, dominance). Cheap signals first.
- If the regime is ambiguous (mid-range Fear & Greed), escalate to `mcp__cmc-mcp__get_global_crypto_derivatives_metrics` (global leverage/open interest) — only then. This is value-of-information metering.

### Step 4 — Compute the envelope
- reward:risk = |take-profit − entry| / |entry − stop|. If reward:risk < 2.0 → **DECLINE** (exclude the trade).
- risk fraction = 1% of equity × regime multiplier (Fear & Greed / altcoin-season / leverage), each frothy reading shrinking size; floor 0.25×.
- Clamp the risk fraction to 10% of the remaining drawdown budget (drawdown governor) so a single stop-out cannot breach the max-drawdown limit.
- position size (USD) = (equity × risk fraction × entry) / |entry − stop|, capped at the intended size. If capped below intended → **SIZE_DOWN**, else **APPROVE**.

## Report Structure

```
RISK ENVELOPE — $TOKEN $SIDE
Verdict:        APPROVE | SIZE_DOWN | DECLINE
Size:           $X,XXX  (intended $Y,YYY)
Entry:          $XX.XX
Stop:           $XX.XX   (CMC support)
Take-Profit:    $XX.XX   (CMC resistance / Fib X.XXX)
Reward:Risk:    X.XX
Regime:         F&G XX, altcoin-season XX  -> size x0.XX
Reason:         <one line citing the CMC levels and regime>
```

## Handling Tool Failures

1. `get_crypto_technical_analysis` is CRITICAL — if it fails or returns no support/resistance, retry once; if still empty, **DECLINE by default** ("risk signals unavailable") and say so. Never invent levels.
2. `get_global_metrics_latest` failed → use a neutral regime multiplier (1.0) and note "regime unavailable — using neutral sizing".
3. `get_global_crypto_derivatives_metrics` is OPTIONAL — skip silently, note "leverage check skipped".
4. Always deliver a verdict with a reason rather than no answer. The safe default is DECLINE, never an oversized APPROVE.

## Important Notes
This skill provides risk discipline, not financial advice. Stops and take-profits are read from CoinMarketCap technical levels; sizing is fixed-fractional bounded by a drawdown governor. Backtest your strategy's own trade log through the engine before trusting it live.
