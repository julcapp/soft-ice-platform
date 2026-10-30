#!/usr/bin/env bash
set -euo pipefail
base='http://127.0.0.1:8801/api/v1/pricing/quote'
check() {
  name="$1"
  body="$2"
  echo "CASE=$name"
  curl -sS -X POST "$base" -H 'Content-Type: application/json' --data "$body"
  echo
}
check base '{"machineId":"TEST-MACHINE-001","channel":"TERMINAL","items":[{"productId":"icecream_creamy","quantity":1}]}'
check strawberry_confetti '{"machineId":"TEST-MACHINE-001","channel":"TERMINAL","items":[{"productId":"icecream_creamy","quantity":1},{"productId":"topping_strawberry","quantity":1},{"productId":"sprinkle_confetti","quantity":1}]}'
check chocolate_nuts '{"machineId":"TEST-MACHINE-001","channel":"TERMINAL","items":[{"productId":"icecream_creamy","quantity":1},{"productId":"topping_chocolate","quantity":1},{"productId":"sprinkle_nuts","quantity":1}]}'
