"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logomark } from "./Logomark";

const LINKS = [
  { href: "/desk", label: "Desk" },
  { href: "/proof", label: "Proof" },
  { href: "/fork", label: "Fork" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{ borderBottom: "1px solid var(--rule-strong)", background: "linear-gradient(to bottom, rgba(27,22,18,0.6), transparent)" }}
    >
      <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-10">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 sm:gap-7">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" style={{ textDecoration: "none" }} aria-label="The Underwriter — home">
            <Logomark size={28} decorative />
            <span className="uw-serif text-[23px] font-semibold tracking-tight" style={{ color: "var(--paper)" }}>The Underwriter</span>
          </Link>
          <nav className="flex items-center gap-1.5 text-[12.5px]" aria-label="Primary">
            {LINKS.map(({ href, label }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="uw-navlink"
                  data-active={active ? "true" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden w-full items-stretch sm:flex sm:w-auto">
          <div className="flex flex-1 flex-col gap-px text-right" style={{ padding: "2px 20px" }}>
            <span className="uw-label" style={{ fontSize: "9.5px", letterSpacing: "0.22em" }}>Fear &amp; Greed</span>
            <span className="uw-serif text-[19px] font-semibold leading-tight" style={{ color: "var(--clay)" }}>19</span>
          </div>
          <div className="flex flex-1 flex-col gap-px text-right" style={{ padding: "2px 20px", borderLeft: "1px solid var(--rule)" }}>
            <span className="uw-label" style={{ fontSize: "9.5px", letterSpacing: "0.22em" }}>BTC Dominance</span>
            <span className="uw-serif text-[19px] font-semibold leading-tight" style={{ color: "var(--paper)" }}>58.1%</span>
          </div>
          {/* [FIX #6] these two figures are static reference values, not a live feed —
              label them honestly and drop the pulsing-live dot affordance. */}
          <div className="flex items-center" style={{ padding: "2px 20px", borderLeft: "1px solid var(--rule)" }}>
            <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase" style={{ color: "var(--paper-70)", letterSpacing: "0.2em" }}>
              Reference regime
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
