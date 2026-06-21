export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto mt-2 max-w-[1180px] border-t px-6 pb-14 pt-10 md:px-10" style={{ borderColor: "var(--rule-strong)" }}>
      <div className="flex flex-wrap items-center justify-between gap-7">
        <p className="uw-serif m-0 text-[19px] font-medium" style={{ lineHeight: 1.4, color: "var(--paper)", maxWidth: "62ch" }}>
          At equal exposure the envelope turned an <em style={{ fontStyle: "italic", color: "var(--brand)" }}>−9.6%</em> bleed into a <em style={{ fontStyle: "italic", color: "var(--brand)" }}>−0.4%</em> scratch and a Calmar four times better than a size cut alone — every figure reproducible from the on-chain record.
        </p>
        <a className="inline-flex items-center gap-2.5 whitespace-nowrap pb-1 text-[13.5px] font-semibold" style={{ color: "var(--brand)", letterSpacing: "0.04em", borderBottom: "1px solid var(--brand-glow)" }} href="/proof">on-chain proof ↗</a>
      </div>
      <div className="mt-7 flex flex-wrap justify-between gap-4 border-t pt-5 text-[11px]" style={{ borderColor: "var(--rule)", color: "var(--paper-45)", letterSpacing: "0.04em" }}>
        <span>The Underwriter <span className="uw-serif italic" style={{ color: "var(--brand)" }}>·</span> a forkable CoinMarketCap Agent Skill</span>
        <span>Research Note №&nbsp;001 <span className="uw-serif italic" style={{ color: "var(--brand)" }}>·</span> equal-exposure Calmar ablation <span className="uw-serif italic" style={{ color: "var(--brand)" }}>·</span> 2022 BNB bear</span>
      </div>
    </footer>
  );
}
