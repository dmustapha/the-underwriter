"use client";
import { RiskEnvelope } from "../../src/types";

const BADGE: Record<string, string> = {
  APPROVE: "uw-badge uw-badge-approve",
  SIZE_DOWN: "uw-badge uw-badge-sizedown",
  DECLINE: "uw-badge uw-badge-decline",
};

const VERDICT_COPY: Record<string, string> = {
  APPROVE: "APPROVE",
  SIZE_DOWN: "SIZE DOWN",
  DECLINE: "DECLINE",
};

const baseScanTx = (h: string) => `https://basescan.org/tx/${h}`;

export function EnvelopeCard({ envelope }: { envelope: RiskEnvelope }) {
  const approved = envelope.verdict === "APPROVE";
  const declined = envelope.verdict === "DECLINE";
  const verdictColor = declined ? "var(--clay)" : "var(--brand)";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="uw-eyebrow mb-2">Verdict · {envelope.token} {envelope.side}</div>
          <div className="uw-serif flex items-baseline gap-3.5 font-bold" style={{ fontSize: "clamp(40px,5vw,52px)", lineHeight: 0.95, letterSpacing: "-0.02em", color: verdictColor }}>
            {VERDICT_COPY[envelope.verdict] ?? envelope.verdict}
            <span className={BADGE[envelope.verdict] ?? "uw-badge"}>{envelope.verdict}</span>
          </div>
        </div>

        {/* wax-stamp seal — only when the trade cleared the floor */}
        {approved && (
          <div className="uw-seal" aria-hidden="true">
            <svg viewBox="0 0 120 120" width="100%" height="100%">
              <defs>
                <path id="uwSealCircle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
              </defs>
              <circle cx="60" cy="60" r="54" fill="none" stroke="#c8a24a" strokeWidth="1" opacity="0.5" />
              <circle cx="60" cy="60" r="47" fill="rgba(200,162,74,0.10)" stroke="#c8a24a" strokeWidth="2.5" />
              <text fill="#c8a24a" fontFamily="var(--font-fraunces, serif)" fontSize="9.5" fontWeight="600" letterSpacing="2.2">
                <textPath href="#uwSealCircle" startOffset="2%">· THE UNDERWRITER · RISK ENVELOPE CLEARED ·</textPath>
              </text>
              <text x="60" y="56" textAnchor="middle" fill="#c8a24a" fontFamily="var(--font-fraunces, serif)" fontSize="16" fontWeight="700" letterSpacing="0.5">APPROVED</text>
              <line x1="36" y1="64" x2="84" y2="64" stroke="#c8a24a" strokeWidth="0.8" opacity="0.6" />
              <text x="60" y="78" textAnchor="middle" fill="#c8a24a" fontFamily="var(--font-hanken, sans-serif)" fontSize="8" fontWeight="600" letterSpacing="1.5">
                R:R {envelope.rewardRisk.toFixed(2)}
              </text>
            </svg>
          </div>
        )}
      </div>

      {/* ruled metrics */}
      <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-6" style={{ borderColor: "var(--brand-glow)" }}>
        <Figure label="Size" value={`$${envelope.size.toFixed(0)}`} />
        <Figure label="Reward vs risk" value={`${envelope.rewardRisk.toFixed(2)}×`} accent />
        <Figure label="Stop · support" value={envelope.stop.toFixed(2)} />
        <Figure label="Target · resistance" value={envelope.takeProfit.toFixed(2)} />
      </div>

      {/* [FIX #7] a fail-safe DECLINE (signals unavailable) is not a risk verdict —
          flag it in clay so it reads differently from a real DECLINE. */}
      {envelope.degraded && (
        <div className="mt-6 rounded-r-[3px] px-4 py-3 text-[13px]" style={{ background: "rgba(181,101,75,0.1)", borderLeft: "2px solid var(--clay)", color: "var(--clay)", lineHeight: 1.6 }}>
          Declined fail-safe — signals unavailable, not a risk verdict.
        </div>
      )}

      <div className="mt-6 rounded-r-[3px] px-4 py-4 text-[13.5px]" style={{ background: "var(--brand-dim)", borderLeft: "2px solid var(--brand)", color: "var(--paper-70)", lineHeight: 1.65 }}>
        {envelope.reason}
      </div>

      {envelope.receipts.length > 0 && (
        <div className="uw-mono mt-4 text-xs" style={{ color: "var(--paper-70)" }}>
          {envelope.receipts.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span>{r.endpoint} · ${r.amountUsd}</span>
              {r.txHash
                ? <a className="uw-link" href={baseScanTx(r.txHash)} target="_blank" rel="noreferrer">BaseScan ↗</a>
                : <span style={{ color: "var(--paper-70)" }}>(cached)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="uw-label mb-1" style={{ fontSize: "9.5px", letterSpacing: "0.18em" }}>{label}</div>
      <div className="uw-kpi uw-mono" style={accent ? { color: "var(--brand)" } : { color: "var(--paper)" }}>{value}</div>
    </div>
  );
}
