import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";

const display = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-fraunces" });
const body = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-hanken" });

export const metadata: Metadata = {
  title: "The Underwriter — CMC risk skill",
  description: "Underwrite any trading-agent signal into a full risk envelope — proven by an equal-exposure ablation, paid per call with x402 USDC on Base.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
