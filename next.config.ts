import type { NextConfig } from "next";
// API routes read fixtures from disk via node:fs — keep server-only.
// outputFileTracingRoot pins serverless file-tracing to THIS project (multiple lockfiles exist
// on the dev machine) so fixtures/ablation.json + fixtures/cmc/* get bundled into the API routes.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@x402/fetch", "@x402/evm", "viem"],
  outputFileTracingRoot: import.meta.dirname,
};
export default nextConfig;
