#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8791}"
MACHINE_ID="${MACHINE_ID:-TEST-MACHINE-001}"
API_KEY="${EQUIPMENT_INTEGRATION_API_KEY:-}"
ADMIN_ROLE="${ADMIN_ROLE:-ADMIN}"
COMMAND_ID="${COMMAND_ID:-smoke-$(date +%s)}"

if [[ -z "$API_KEY" ]]; then
  echo "EQUIPMENT_INTEGRATION_API_KEY is required" >&2
  exit 2
fi

json_header=(-H 'Content-Type: application/json')
supplier_header=(-H "X-API-Key: $API_KEY")

echo "[1/7] health"
curl -fsS "$BASE_URL/equipment/v1/health"; echo

echo "[2/7] heartbeat"
curl -fsS -X POST "${supplier_header[@]}" "${json_header[@]}" \
  "$BASE_URL/equipment/v1/machines/$MACHINE_ID/heartbeat" \
  --data "{\"machine_id\":\"$MACHINE_ID\",\"status\":\"READY\",\"online\":true,\"controller_version\":\"smoke-test\"}"; echo

echo "[3/7] telemetry"
curl -fsS -X POST "${supplier_header[@]}" "${json_header[@]}" \
  "$BASE_URL/equipment/v1/machines/$MACHINE_ID/telemetry" \
  --data "{\"machine_id\":\"$MACHINE_ID\",\"telemetry\":{\"temperature_c\":-4.0,\"cups_remaining\":99,\"mix_level_percent\":80}}"; echo

echo "[4/7] create local admin test-dispense"
curl -fsS -X POST -H "X-Admin-Role: $ADMIN_ROLE" "${json_header[@]}" \
  "$BASE_URL/api/v1/admin/equipment/machines/$MACHINE_ID/test-dispense" \
  --data "{\"command_id\":\"$COMMAND_ID\",\"payload\":{\"product_code\":\"ICE_CREAM_BASE\",\"test\":true}}"; echo

echo "[5/7] poll command"
curl -fsS "${supplier_header[@]}" \
  "$BASE_URL/equipment/v1/machines/$MACHINE_ID/commands"; echo

echo "[6/7] ACK"
curl -fsS -X POST "${supplier_header[@]}" "${json_header[@]}" \
  "$BASE_URL/equipment/v1/machines/$MACHINE_ID/commands/$COMMAND_ID/ack" \
  --data '{}'; echo

echo "[7/7] SUCCESS"
curl -fsS -X POST "${supplier_header[@]}" "${json_header[@]}" \
  "$BASE_URL/equipment/v1/machines/$MACHINE_ID/dispense/result" \
  --data "{\"machine_id\":\"$MACHINE_ID\",\"command_id\":\"$COMMAND_ID\",\"status\":\"SUCCESS\"}"; echo

echo "Dashboard snapshot:"
curl -fsS -H "X-Admin-Role: $ADMIN_ROLE" \
  "$BASE_URL/api/v1/admin/equipment/machines/$MACHINE_ID"; echo

echo "Equipment sandbox smoke test completed successfully."
