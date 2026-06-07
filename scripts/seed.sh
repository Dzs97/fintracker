#!/usr/bin/env bash
# Seed June 2026 data into the deployed FinTracker via its HTTP API.
# Usage: BASE=https://fintracker-rosy.vercel.app ./scripts/seed.sh
set -euo pipefail

BASE="${BASE:-https://fintracker-rosy.vercel.app}"

post() {
  local path="$1" body="$2"
  curl -sS -f -X POST "$BASE$path" -H "Content-Type: application/json" -d "$body" > /dev/null
  printf "."
}

echo "Seeding into $BASE"

echo -n "income"
post /api/entries '{"type":"income","name":"Treeline","amount":625,"date":"2026-06-03","note":""}'
echo

echo -n "expenses"
post /api/entries '{"type":"expense","name":"Card payment","amount":5416,"cat":"Card Payments","date":"2026-06-03","note":"OpenBank"}'
post /api/entries '{"type":"expense","name":"Coffee","amount":150,"cat":"Food & Dining","date":"2026-06-04","note":"DolarApp"}'
echo

echo -n "investments"
post /api/investments '{"name":"Nubank","amount":1000,"date":"2026-06-03","note":"","gf":true,"inv_type":"stock","purchase_price":11.64}'
post /api/investments '{"name":"Fintual","amount":1500,"date":"2026-06-01","note":"","gf":false,"inv_type":"fund","historical":true}'
post /api/investments '{"name":"Fintual","amount":500,"date":"2026-06-01","note":"","gf":true,"inv_type":"fund","historical":true}'
post /api/investments '{"name":"Nubank","amount":750,"date":"2026-06-04","note":"","gf":false,"inv_type":"stock","purchase_price":11.64}'
post /api/investments '{"name":"Fintual","amount":1500,"date":"2026-06-03","note":"","gf":false,"inv_type":"fund"}'
echo

echo -n "cc"
post /api/cc '{"name":"Sakura Arena de gato","amount":637,"date":"2026-06-01","cat":"Pets","card":"OpenBank"}'
post /api/cc '{"name":"UberEats","amount":436,"date":"2026-06-02","cat":"Food & Dining","card":"OpenBank"}'
post /api/cc '{"name":"UberEats","amount":247,"date":"2026-06-02","cat":"Food & Dining","card":"OpenBank"}'
post /api/cc '{"name":"SuMesa Super","amount":868,"date":"2026-06-03","cat":"Groceries","card":"OpenBank"}'
post /api/cc '{"name":"UberEats","amount":503,"date":"2026-06-03","cat":"Food & Dining","card":"OpenBank"}'
post /api/cc '{"name":"UberEats","amount":294,"date":"2026-06-03","cat":"Food & Dining","card":"OpenBank"}'
post /api/cc '{"name":"Nagaoka","amount":746,"date":"2026-06-04","cat":"Food & Dining","card":"Amex"}'
post /api/cc '{"name":"Amazon","amount":178,"date":"2026-06-04","cat":"Shopping","card":"Amex"}'
post /api/cc '{"name":"Uber","amount":130,"date":"2026-06-04","cat":"Transport","card":"OpenBank"}'
post /api/cc '{"name":"Uber","amount":105,"date":"2026-06-04","cat":"Transport","card":"OpenBank"}'
post /api/cc '{"name":"UberEats","amount":782,"date":"2026-06-04","cat":"Food & Dining","card":"OpenBank"}'
echo

echo -n "prices"
curl -sS -f -X PATCH "$BASE/api/investments" -H "Content-Type: application/json" \
  -d '{"ticker":"Nubank","price":11.64}' > /dev/null
echo

echo "done."
