"use client";
import { useState, useEffect } from "react";
import { AblationChart } from "./AblationChart";
import { AblationResult } from "../../src/types";

export function AblationExhibit({ variant = "chart" }: { variant?: "chart" | "ledger" }) {
  const [ablation, setAblation] = useState<AblationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function backtest() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/backtest", { method: "POST" });
      if (!res.ok) throw new Error(`backtest failed (HTTP ${res.status})`);
      setAblation((await res.json()) as AblationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "backtest failed — try again");
    } finally {
      setLoading(false);
    }
  }

  // PRD §7.5: the ablation must render immediately on first visit (no empty state).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { backtest(); }, []);

  const boxH = variant === "ledger" ? "h-[160px]" : "h-[300px]";
  // [FIX #9] idle and loading now read differently, and a failure shows recovery.
  const placeholder = (text: string) => (
    <div className={`uw-mono grid ${boxH} place-items-center text-sm italic`} style={{ color: "var(--paper-70)" }} aria-live="polite">
      {text}
    </div>
  );

  let body;
  if (ablation) {
    body = <AblationChart result={ablation} startEquity={10000} variant={variant} />;
  } else if (loading) {
    body = placeholder(variant === "ledger" ? "tallying the ledger…" : "drawing the exhibit…");
  } else if (error) {
    body = (
      <div className={`grid ${boxH} place-items-center`}>
        {/* [FIX #9] retry path so a backtest failure isn't a dead end */}
        <button className="uw-btn uw-btn-ghost" onClick={backtest}>Retry</button>
      </div>
    );
  } else {
    body = placeholder("preparing the exhibit…");
  }

  return (
    <div>
      {error && (
        <div className="uw-mono mb-4 rounded-[3px] px-4 py-3 text-sm" style={{ background: "rgba(181,101,75,.1)", border: "1px solid rgba(181,101,75,.4)", color: "var(--clay)" }} role="alert">
          {error}
        </div>
      )}
      {body}
    </div>
  );
}
