# Agent loop — captured transcript

A momentum signal agent (RSI × MACD × Fear&Greed) hands every proposed trade to The Underwriter
before placing it, and acts on the verdict. Deterministic + offline against the committed BNB
daily klines. Reproduce with `pnpm example` (`examples/agent-loop.ts`).

```

  THE UNDERWRITER · agent loop
  a momentum agent underwrites every trade before placing it
  account $10,000 · max drawdown budget 30.0% · 13 signals (RSI×MACD×F&G)
──────────────────────────────────────────────────────────────────────────────
  # 1  2021-12-27  BNB long · agent wants $12,000
      → SIZE_DOWN  place $5,221  stop 557.85  TP 584.15  R:R 3.50
      → filled: $-54  ·  account $9,946  ·  drawdown 0.5%
  # 2  2022-01-02  BNB long · agent wants $12,000
      → DECLINE  reward:risk 0.08 < 2 (support 522.20, resistance 531.70) — excluded
      → agent skips. no trade placed.
  # 3  2022-02-04  BNB long · agent wants $12,000
      → DECLINE  reward:risk 0.15 < 2 (support 380.90, resistance 402.32) — excluded
      → agent skips. no trade placed.
  # 4  2022-03-03  BNB long · agent wants $12,000
      → DECLINE  reward:risk 0.18 < 2 (support 397.70, resistance 403.50) — excluded
      → agent skips. no trade placed.
  # 5  2022-03-18  BNB long · agent wants $12,000
      → APPROVE    place $12,000  stop 396.30  TP 400.80  R:R 4.00
      → filled: $-27  ·  account $9,919  ·  drawdown 0.8%
  # 6  2022-05-23  BNB long · agent wants $12,000
      → DECLINE  reward:risk 0.22 < 2 (support 312.70, resistance 318.20) — excluded
      → agent skips. no trade placed.
  # 7  2022-05-30  BNB long · agent wants $12,000
      → SIZE_DOWN  place $2,162  stop 313.80  TP 339.40  R:R 2.20
      → filled: $-54  ·  account $9,865  ·  drawdown 1.4%
  # 8  2022-06-27  BNB long · agent wants $12,000
      → DECLINE  reward:risk 0.88 < 2 (support 229.67, resistance 237.43) — excluded
      → agent skips. no trade placed.
  # 9  2022-07-13  BNB long · agent wants $12,000
      → DECLINE  reward:risk 0.14 < 2 (support 225.87, resistance 231.13) — excluded
      → agent skips. no trade placed.
  #10  2022-09-09  BNB long · agent wants $12,000
      → SIZE_DOWN  place $6,049  stop 290.81  TP 311.03  R:R 6.80
      → filled: $-53  ·  account $9,811  ·  drawdown 1.9%
  #11  2022-09-28  BNB long · agent wants $12,000
      → DECLINE  reward:risk 0.23 < 2 (support 276.03, resistance 282.87) — excluded
      → agent skips. no trade placed.
  #12  2022-10-24  BNB long · agent wants $12,000
      → APPROVE    place $12,000  stop 273.83  TP 276.11  R:R 7.52
      → filled: $-12  ·  account $9,800  ·  drawdown 2.0%
  #13  2022-11-25  BNB long · agent wants $12,000
      → SIZE_DOWN  place $11,409  stop 299.40  TP 304.90  R:R 2.93
      → filled: +$156  ·  account $9,955  ·  drawdown 0.4%
──────────────────────────────────────────────────────────────────────────────
  verdicts:   2 approved · 4 sized-down · 7 declined
  underwritten account:  $9,955  (drawdown held to 0.4%)
  same signals, no underwriting (full size every time):  $9,040

──────────────────────────────────────────────────────────────────────────────
  GOVERNOR · same signals, but the account starts 28.5% into a 30% drawdown budget
──────────────────────────────────────────────────────────────────────────────
  #1  → SIZE_DOWN  place $1,033 (vs $12,000 asked) · 1.5% budget left → 1.4%
  #5  → SIZE_DOWN  place $4,388 (vs $12,000 asked) · 1.4% budget left → 1.3%
  #7  → SIZE_DOWN  place $371 (vs $12,000 asked) · 1.3% budget left → 1.2%
  #10  → SIZE_DOWN  place $968 (vs $12,000 asked) · 1.2% budget left → 1.1%
  #12  → SIZE_DOWN  place $8,155 (vs $12,000 asked) · 1.1% budget left → 1.0%
  #13  → SIZE_DOWN  place $1,582 (vs $12,000 asked) · 1.0% budget left → 1.3%
  → the governor sized every $12,000 ask down to fit the thin budget — it never let one trade exhaust it.
  (At currentDrawdown == the budget it stops sizing and DECLINEs outright — proven in tests/account-context.test.ts.)

  the agent never had to know risk math — it just asked first.

```

**Reading it:** same 13 signals as the backtest — **7 declined**, **4 sized-down**, **2 approved**.
The underwritten account holds drawdown near zero (**$9,955**); the same signals filled full-size
with no underwriting bleed to **$9,040** (the raw arm of the published ablation, −9.6%). The second
block shows the **drawdown governor (§8)**: on an account already 28.5% into its 30% budget, the
same $12,000 asks are clamped to a few hundred–few thousand dollars to fit the thin remaining
budget; at the hard limit it DECLINEs outright (see `tests/account-context.test.ts`).
