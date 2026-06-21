// The Underwriter seal mark — a serif "U" monogram on the underwrite floor line,
// inside a seal ring. Fuses the product's two signatures: the APPROVE wax seal and
// the line the Underwriter draws *under* every trade (the support/stop floor).
// Pure SVG, inherits the Tearsheet gold; scales from 16px favicon to the masthead.
// `decorative` hides the mark from the a11y tree — pass it when the Logomark
// sits inside an already-labeled link, so the name isn't announced twice. [FIX #13]
export function Logomark({ size = 30, className, decorative = false }: { size?: number; className?: string; decorative?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "The Underwriter"}
      aria-hidden={decorative ? true : undefined}
    >
      <circle cx="32" cy="32" r="30.5" stroke="var(--brand-glow)" strokeWidth="1.4" />
      <path
        d="M21 18 V32 C21 39 26 43.5 32 43.5 C38 43.5 43 39 43 32 V18"
        stroke="var(--brand)"
        strokeWidth="4.6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M17 18 H25 M39 18 H47" stroke="var(--brand)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M20 51 H44" stroke="var(--brand)" strokeWidth="3.8" strokeLinecap="round" />
    </svg>
  );
}
