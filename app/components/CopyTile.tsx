"use client";
import { useState } from "react";

export function CopyTile({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="uw-tile overflow-hidden p-0" style={{ background: "var(--ink-0)" }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px dashed var(--rule)" }}>
        <span className="uw-label">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="uw-btn uw-btn-ghost"
          style={{ padding: "5px 13px", fontSize: "12px" }}
          aria-live="polite"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="uw-mono overflow-x-auto px-5 py-4 text-[12.5px] leading-relaxed" style={{ color: "var(--paper-70)", margin: 0 }}>
        {code}
      </pre>
    </div>
  );
}
