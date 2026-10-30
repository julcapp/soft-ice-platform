#!/usr/bin/env bash
set -euo pipefail
OUT=/home/julcapp/deploy-staging/predeploy-check.out
exec >"$OUT" 2>&1
echo "=== Soft ICE predeploy check ==="
date -Is
echo "--- service ---"
systemctl show soft-ice-platform-v036.service -p ActiveState -p SubState -p WorkingDirectory -p MainPID
echo "--- staged commit ---"
git -C /home/julcapp/soft-ice-worktrees/display-product-v1 rev-parse --short HEAD
echo "--- env ---"
test -r /etc/soft-ice-platform-v036.env && echo ENV_READABLE_AS_ROOT
set -a
source /etc/soft-ice-platform-v036.env
set +a
echo "--- schema tables ---"
psql "$DATABASE_URL" -Atc "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('CatalogItem','MachineCatalogItem','PricingQuote','PricingSnapshot') ORDER BY tablename;"
echo "--- test machine ---"
psql "$DATABASE_URL" -Atc "SELECT "machineCode",id FROM "Machine" WHERE "machineCode"='TEST-MACHINE-001';"
echo "--- catalog fixture SKUs ---"
psql "$DATABASE_URL" -Atc "SELECT sku,"nameRu","basePrice",currency FROM "CatalogItem" WHERE sku IN ('icecream_creamy','topping_chocolate','topping_strawberry','topping_caramel','topping_none','sprinkle_nuts','sprinkle_confetti','sprinkle_wafer','sprinkle_none') ORDER BY sku;" 2>/dev/null || true
echo "--- latest migrations ---"
psql "$DATABASE_URL" -Atc "SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 12;" 2>/dev/null || true
echo "=== end ==="
chmod 0644 "$OUT"
