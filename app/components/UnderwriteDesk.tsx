"use client";
import { useState } from "react";
import { EnvelopeCard } from "./EnvelopeCard";
import { RiskEnvelope } from "../../src/types";

interface EvidencePath {
  signalPulls: number;
  paidPulls: number;
  spendUsd: number;
  escalated: boolean;
  pullsSaved: number;
  naivePulls: number;
  levelsSource: "live" | "fixture";
  regimeSource: "x402" | "rest" | "cache";
}

export function UnderwriteDesk() {
  const [token, setToken] = useState("BNB");
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState(1000);
  const [entry, setEntry] = useState(0); // 0 = use the live/closed-form entry from CMC TA
  const [envelope, setEnvelope] = useState<RiskEnvelope | null>(null);
  const [evidence, setEvidence] = useState<EvidencePath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function underwrite() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/underwrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, side, intendedSize: size, ...(entry > 0 ? { entryPrice: entry } : {}) }) });
      if (!res.ok) throw new Error(`underwrite failed (HTTP ${res.status})`);
      const json = (await res.json()) as { envelope: RiskEnvelope; evidencePath: EvidencePath };
      setEnvelope(json.envelope);
      setEvidence(json.evidencePath); // [CRITIQUE #4] honest evidence scoreboard
    } catch (e) {
      setError(e instanceof Error ? e.message : "underwrite failed — try again");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      {error && (
        <div className="uw-mono mb-7 rounded-[3px] px-4 py-3 text-sm" style={{ background: "rgba(181,101,75,.1)", border: "1px solid rgba(181,101,75,.4)", color: "var(--clay)" }} aria-live="polite">
          {error}
        </div>
      )}

      {/* ── UNDERWRITE FORM + VERDICT ── */}
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[0.86fr_1.14fr]">
        {/* form */}
        <div className="uw-tile p-7" style={{ background: "var(--ink-1)" }}>
          <h3 className="uw-serif m-0 mb-1 text-[18px] font-semibold">Proposed trade</h3>
          <p className="m-0 mb-6 text-[12.5px]" style={{ color: "var(--paper-45)" }}>Drive it by hand here — or an agent calls the same skill before it trades. Entry left blank pulls the live quote at submission.</p>

          <label className="mb-4 block">
            <span className="uw-label mb-2 block">Token</span>
            <select className="uw-ctl" value={token} onChange={(e) => setToken(e.target.value)}>
              <option value="BNB">BNB</option>
              <option value="CAKE">CAKE</option>
            </select>
          </label>

          <div className="mb-4 grid grid-cols-2 gap-3.5">
            <label className="block">
              <span className="uw-label mb-2 block">Side</span>
              <select className="uw-ctl" value={side} onChange={(e) => setSide(e.target.value as "long" | "short")}>
                <option value="long">long</option><option value="short">short</option>
              </select>
            </label>
            <label className="block">
              <span className="uw-label mb-2 block">Size (USD)</span>
              <input className="uw-ctl" type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </label>
          </div>

          <label className="mb-1 block">
            <span className="uw-label mb-2 block">Entry</span>
            <input className="uw-ctl" type="number" value={entry || ""} placeholder="live" onChange={(e) => setEntry(Number(e.target.value))} />
          </label>

          <div className="mt-6">
            <button className="uw-btn uw-btn-primary w-full" onClick={underwrite} disabled={loading}>
              {loading ? "Underwriting…" : "Underwrite this trade"}
            </button>
          </div>
          {loading && <p className="uw-mono mt-3 text-xs italic" style={{ color: "var(--paper-45)" }}>Reading CMC levels and settling the live-data payment on Base — a few seconds…</p>}
        </div>

        {/* verdict */}
        <div
          className="uw-tile p-7"
          aria-live="polite"
          style={{ background: "linear-gradient(180deg, rgba(200,162,74,0.05), transparent 24%), var(--ink-2)", border: "1px solid var(--brand-glow)" }}
        >
          {envelope
            ? (
              <>
                <div className="uw-eyebrow mb-4" style={{ color: "var(--paper-45)" }}>What the calling agent receives</div>
                <EnvelopeCard envelope={envelope} />
              </>
            )
            : (
              <div className="flex h-full flex-col">
                <div className="uw-eyebrow mb-8">Risk envelope</div>
                <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-[3px] p-5" style={{ border: "1px dashed var(--rule)", background: "var(--ink-1)" }}>
                    <div className="uw-label mb-2">Empty state</div>
                    <div className="text-[13px] italic" style={{ color: "var(--paper-45)" }}>
                      <span style={{ color: "var(--brand)", fontStyle: "normal", marginRight: 8 }}>—</span>
                      Submit a trade to see its envelope. Nothing is sized until it&apos;s underwritten.
                    </div>
                  </div>
                  <div className="rounded-[3px] p-5" style={{ border: "1px solid rgba(181,101,75,0.4)", background: "var(--ink-1)" }}>
                    <div className="uw-label mb-2" style={{ color: "var(--clay)" }}>If it fails the floor</div>
                    <div className="uw-serif text-[18px] font-bold" style={{ color: "var(--clay)" }}>DECLINE</div>
                    <div className="mt-1 text-[12px]" style={{ color: "var(--paper-45)" }}>Reward vs risk below the floor — no size assigned, no trade taken.</div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* ── x402 RECEIPT ── */}
      <section className="border-t py-12 mt-12" style={{ borderColor: "var(--rule)" }}>
        <div className="uw-sec-head mb-7">
          <span className="uw-sec-num">§</span>
          <h2 className="uw-sec-h2">Real data, paid for once</h2>
          <span className="uw-sec-fill" />
          <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>Settlement on Base</span>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="uw-tile overflow-hidden p-0" style={{ background: "var(--ink-1)" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px dashed var(--rule)" }}>
              <span className="uw-label">Live data receipt</span>
              <span className="inline-flex items-center gap-2 text-[9.5px] font-semibold uppercase" style={{ color: "var(--paper-70)", letterSpacing: "0.2em" }}>
                <span className="uw-dot" /> {evidence ? "settled" : "standby"}
              </span>
            </div>
            <div className="px-6 py-5">
              {evidence ? (
                <>
                  <div className="flex items-baseline justify-between py-2.5 text-[14px]" style={{ borderBottom: "1px solid var(--rule)", color: "var(--paper-70)" }}>
                    <span>{evidence.paidPulls > 0 ? "Live price quote · paid on-chain" : "Price quote · served from cache"}</span>
                    <span className="uw-serif text-[16px] font-semibold uw-mono" style={{ color: "var(--paper)" }}>${evidence.spendUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-baseline justify-between py-2.5 text-[14px]" style={{ borderBottom: "1px solid var(--rule)", color: "var(--paper-70)" }}>
                    <span>Signals consulted · {evidence.signalPulls} of {evidence.naivePulls}</span>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--brand)" }}>
                      {evidence.pullsSaved > 0 ? `${evidence.pullsSaved} fewer pull${evidence.pullsSaved > 1 ? "s" : ""} · regime decisive` : "full consult · regime ambiguous"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between py-2.5 text-[14px]" style={{ borderBottom: "1px solid var(--rule)", color: "var(--paper-70)" }}>
                    <span>Stop / take-profit levels</span>
                    <span className="uw-mono text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.12em", color: evidence.levelsSource === "live" ? "var(--brand)" : "var(--paper-45)" }}>
                      {evidence.levelsSource === "live" ? "live klines" : "fixture fallback"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-4 text-[14px]">
                    <span className="font-semibold" style={{ color: "var(--paper)" }}>On-chain cost</span>
                    <span className="uw-serif text-[22px] uw-mono" style={{ color: "var(--brand)" }}>${evidence.spendUsd.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <p className="m-0 text-[13px]" style={{ color: "var(--paper-45)", lineHeight: 1.65 }}>
                  Value-of-information metering — the expensive pull is bought only when the signals are ambiguous. Underwrite a position to settle a live receipt here.
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="uw-serif m-0 mb-3.5 text-[24px] font-semibold leading-tight" style={{ letterSpacing: "-0.01em" }}>
              One payment. <em style={{ fontStyle: "italic", color: "var(--brand)" }}>Fewer pulls.</em>
            </h3>
            <p className="m-0 mb-3.5 text-[14.5px]" style={{ color: "var(--paper-70)", lineHeight: 1.7, maxWidth: "42ch" }}>
              Every envelope is priced from a <strong style={{ color: "var(--paper)", fontWeight: 600 }}>real CMC quote</strong>, paid in USDC over x402 the moment it&apos;s needed — that single price is the one on-chain cost. Regime is read from cheap signals first, and the expensive derivatives pull is consulted <strong style={{ color: "var(--paper)", fontWeight: 600 }}>only when the call is close</strong>, so a decisive read makes fewer pulls than a naive agent that consults everything every time.
            </p>
            <p className="m-0 text-[14.5px]" style={{ color: "var(--paper-70)", lineHeight: 1.7, maxWidth: "42ch" }}>
              The transaction hash on each envelope isn&apos;t debug text. It&apos;s the proof that the data was real.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
