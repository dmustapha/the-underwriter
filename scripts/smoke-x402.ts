// Day-1 smoke test: fire ONE real CMC x402 call, print the Base tx hash. Run: pnpm smoke
// Uses the x402-ENABLED quotes endpoint (verified live 2026-06-18); fear-and-greed is NOT payable.
import { cmcClient } from "../src/clients/cmcClient";

async function main(): Promise<void> {
  const res = await cmcClient.getQuoteX402("BNB");
  console.log(`source=${res.source}`);
  if (res.receipt?.txHash) {
    console.log(`x402 OK — Base tx: https://basescan.org/tx/${res.receipt.txHash}`);
    console.log(`payer paid $${res.receipt.amountUsd} USDC for endpoint ${res.receipt.endpoint}`);
  } else {
    console.log("No x402 receipt (used fallback). Check X402_PRIVATE_KEY funding + endpoint path before proceeding.");
  }
  console.log("data sample:", JSON.stringify(res.data).slice(0, 200));
}
main().catch((e) => { console.error(e); process.exit(1); });
