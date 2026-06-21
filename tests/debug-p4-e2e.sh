#!/usr/bin/env bash
# IMPORTANT (CR-7): run the dev server KEYLESS for this script —
#   X402_PRIVATE_KEY="" CMC_PRO_API_KEY="" CMC_MCP_API_KEY="" pnpm dev
# Each /api/underwrite hit with a funded payer key fires a real $0.01 USDC payment on Base.
# Keyless = the production demo path (SEC-1) and costs nothing.
#
# DEBUG Phase 4 — Tier-2 curl E2E against a running dev server. Covers the 3 PRD user flows
# (underwrite happy/decline/fail-safe, value-of-information metering shape, ablation backtest)
# plus a recovery check (state consistent after a DECLINE). Run: bash tests/debug-p4-e2e.sh
set -uo pipefail
BASE="${BASE:-http://localhost:3000}"
PASS=0; FAIL=0
chk() { # chk "name" actual expected
  if [ "$2" = "$3" ]; then echo "  PASS: $1 ($2)"; PASS=$((PASS+1)); else echo "  FAIL: $1 — got '$2' want '$3'"; FAIL=$((FAIL+1)); fi
}
jqv() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(\"d$1\"))" 2>/dev/null; }

echo "== Flow 1a: underwrite @614 returns a well-formed envelope (verdict is data-dependent now that levels are LIVE) =="
R=$(curl -s -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d '{"token":"BNB","side":"long","intendedSize":1000,"entryPrice":614}')
chk "verdict valid"          "$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['envelope']['verdict'] in ('APPROVE','SIZE_DOWN','DECLINE'))")" "True"
chk "verdict↔size coherent"  "$(echo "$R" | python3 -c "import sys,json;e=json.load(sys.stdin)['envelope'];print((e['verdict']=='DECLINE' and e['size']==0) or (e['verdict'] in ('APPROVE','SIZE_DOWN') and e['size']>0 and e['rewardRisk']>=2.0))")" "True"
chk "stop != entry"          "$(echo "$R" | python3 -c "import sys,json;e=json.load(sys.stdin)['envelope'];print(e['stop']!=e['entryPrice'])")" "True"
chk "all envelope fields"    "$(echo "$R" | python3 -c "import sys,json;e=json.load(sys.stdin)['envelope'];print(all(e.get(k) is not None for k in ['size','stop','takeProfit','rewardRisk','verdict','reason']))")" "True"
chk "evidencePath present"   "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print('evidencePath' in d and 'signalPulls' in d['evidencePath'] and 'levelsSource' in d['evidencePath'])")" "True"
chk "evidencePath consistent" "$(echo "$R" | python3 -c "import sys,json;p=json.load(sys.stdin)['evidencePath'];print(abs(p['spendUsd']-p['paidPulls']*0.01)<1e-9 and isinstance(p['escalated'],bool) and p['levelsSource'] in ('live','fixture'))")" "True"

echo "== Flow 1a': the APPROVE path is reachable with LIVE data (sweep entries below the live price; ANY clean APPROVE passes) =="
APPROVE_HIT=False
LIVE=$(curl -s -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d '{"token":"BNB","side":"long","intendedSize":1000}' | python3 -c "import sys,json;print(json.load(sys.stdin)['envelope']['entryPrice'])" 2>/dev/null)
LIVE=${LIVE:-586}
for FRAC in 0.97 0.95 0.92 0.88 0.82; do
  ENTRY=$(python3 -c "print(round($LIVE*$FRAC,2))")
  V=$(curl -s -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d "{\"token\":\"BNB\",\"side\":\"long\",\"intendedSize\":1000,\"entryPrice\":$ENTRY}" | python3 -c "import sys,json;e=json.load(sys.stdin)['envelope'];print('OK' if (e['verdict']=='APPROVE' and e['size']>0 and e['rewardRisk']>=2.0) else e['verdict'])" 2>/dev/null)
  echo "    entry=$ENTRY (frac $FRAC of live $LIVE) -> ${V:-ERR}"
  if [ "${V:-}" = "OK" ]; then APPROVE_HIT=True; break; fi
done
chk "APPROVE reachable (live)" "$APPROVE_HIT" "True"

echo "== Flow 1b: underwrite @ blank entry returns a well-formed envelope (verdict is data-dependent now that entry is the LIVE price, not the stale fixture) =="
R=$(curl -s -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d '{"token":"BNB","side":"long","intendedSize":1000}')
chk "blank-entry verdict valid" "$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['envelope']['verdict'] in ('APPROVE','SIZE_DOWN','DECLINE'))")" "True"
chk "blank-entry entry>0"        "$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['envelope']['entryPrice']>0)")" "True"

echo "== Flow 1c: unsupported token is REJECTED at the allowlist (#7 — never silently priced as BNB) =="
chk "DOGE → 400"             "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d '{"token":"DOGE","side":"long","intendedSize":1000,"entryPrice":0.4}')" "400"

echo "== Flow 3: ablation backtest (depth proof) =="
R=$(curl -s -X POST "$BASE/api/backtest" -H 'content-type: application/json' -d '{}')
chk "3 arms"                 "$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['arms']))")" "3"
chk "fullGate Calmar>flatHaircut" "$(echo "$R" | python3 -c "import sys,json;a={x['arm']:x for x in json.load(sys.stdin)['arms']};print(a['fullGate']['calmar']>a['flatHaircut']['calmar'])")" "True"
chk "7 excluded (DECLINEs dropped)" "$(echo "$R" | python3 -c "import sys,json;a={x['arm']:x for x in json.load(sys.stdin)['arms']};print(a['fullGate']['excludedTrades'])")" "7"
chk "declined array len 7"   "$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['declined']))")" "7"

echo "== Flow 1d (CR-5): short side returns a valid envelope (structure, verdict data-dependent) =="
R=$(curl -s -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d '{"token":"BNB","side":"short","intendedSize":1000,"entryPrice":614}')
chk "short HTTP ok (verdict present)" "$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['envelope']['verdict'] in ('APPROVE','SIZE_DOWN','DECLINE'))")" "True"
chk "short envelope well-formed (stop>entry or declined)" "$(echo "$R" | python3 -c "import sys,json;e=json.load(sys.stdin)['envelope'];print(e['verdict']=='DECLINE' or (e['stop']>e['entryPrice'] and e['takeProfit']<e['entryPrice']))")" "True"

echo "== Input validation (DBG-003): malformed/missing fields → clean 400, not 500 =="
sc() { curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d "$1"; }
chk "empty body → 400"       "$(sc '')" "400"
chk "malformed JSON → 400"   "$(sc '{bad')" "400"
chk "missing token → 400"    "$(sc '{\"side\":\"long\",\"intendedSize\":1000}')" "400"
chk "bad side → 400"         "$(sc '{\"token\":\"BNB\",\"side\":\"sideways\",\"intendedSize\":1000}')" "400"
chk "negative size → 400"    "$(sc '{\"token\":\"BNB\",\"side\":\"long\",\"intendedSize\":-5000}')" "400"
chk "zero size → 400"        "$(sc '{\"token\":\"BNB\",\"side\":\"long\",\"intendedSize\":0}')" "400"
chk "unsupported token → 400" "$(sc '{\"token\":\"PEPE\",\"side\":\"long\",\"intendedSize\":1000}')" "400"

echo "== CSRF / content-type guards (#10) =="
chk "no application/json → 415" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/underwrite" -H 'content-type: text/plain' -d '{\"token\":\"BNB\",\"side\":\"long\",\"intendedSize\":1000}')" "415"
chk "cross-origin → 403"        "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -H 'origin: https://evil.example' -d '{\"token\":\"BNB\",\"side\":\"long\",\"intendedSize\":1000,\"entryPrice\":614}')" "403"

echo "== Recovery: endpoint stays consistent — a well-formed verdict after a DECLINE (no leaked state) =="
curl -s -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d '{"token":"BNB","side":"long","intendedSize":1000,"entryPrice":614}' >/dev/null
R=$(curl -s -X POST "$BASE/api/underwrite" -H 'content-type: application/json' -d '{"token":"BNB","side":"long","intendedSize":1000,"entryPrice":614}')
chk "consistent verdict after decline" "$(echo "$R" | python3 -c "import sys,json;e=json.load(sys.stdin)['envelope'];print(e['verdict'] in ('APPROVE','SIZE_DOWN','DECLINE') and ((e['verdict']=='DECLINE' and e['size']==0) or e['size']>0))")" "True"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
