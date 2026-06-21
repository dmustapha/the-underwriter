import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { UnderwriteDesk } from "../components/UnderwriteDesk";

export default function DeskPage() {
  return (
    <>
      <div className="uw-grid-bg" />
      <div className="uw-glow" />
      <SiteNav />

      <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-16 md:px-10">
        <section className="pt-12 lg:pt-16">
          <div className="mb-5 flex items-center gap-3.5 text-[11px]" style={{ color: "var(--paper-45)", letterSpacing: "0.06em" }}>
            <span className="uw-eyebrow">The Desk</span>
            <span className="inline-block h-px w-6" style={{ background: "var(--brand-glow)" }} />
            <span>Live envelope</span>
          </div>
          <h1 className="uw-serif m-0 mb-4 font-medium" style={{ fontSize: "clamp(30px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: "var(--paper)" }}>
            Underwrite a <em style={{ fontStyle: "italic", color: "var(--brand)", fontWeight: 500 }}>position</em>.
          </h1>
          <p className="m-0 mb-10 text-[16px]" style={{ lineHeight: 1.6, color: "var(--paper-70)", maxWidth: "54ch" }}>
            Hand it a proposed trade and it returns a verdict — approve, size down, or decline — with the stop, the target, the reward against the risk, and a size held to your loss budget. The data is pulled live and paid for on-chain.
          </p>

          <UnderwriteDesk />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
