#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/julcapp/softice-backups
STAGE=/home/julcapp/softice-backup-release

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root"
  exit 2
fi

echo "== CREATE BACKUP STRUCTURE =="
install -d -m 700 -o julcapp -g julcapp "$ROOT"
install -d -m 700 -o julcapp -g julcapp "$ROOT/bin" "$ROOT/logs" "$ROOT/.work"
install -d -m 700 -o julcapp -g julcapp "$ROOT/payments" "$ROOT/messages"
YEAR="$(date -u +%Y)"
install -d -m 700 -o julcapp -g julcapp "$ROOT/payments/$YEAR" "$ROOT/messages/$YEAR"

echo "== INSTALL BACKUP PROGRAM =="
install -m 700 -o julcapp -g julcapp "$STAGE/monthly_backup.js" "$ROOT/bin/monthly_backup.js"

echo "== INSTALL SYSTEMD UNITS =="
install -m 644 "$STAGE/softice-monthly-archive.service" /etc/systemd/system/softice-monthly-archive.service
install -m 644 "$STAGE/softice-monthly-archive.timer" /etc/systemd/system/softice-monthly-archive.timer
systemctl daemon-reload
systemctl enable --now softice-monthly-archive.timer

echo "== RUN FIRST ARCHIVE FOR PREVIOUS TOMSK MONTH =="
systemctl start softice-monthly-archive.service
systemctl is-failed --quiet softice-monthly-archive.service && {
  journalctl -u softice-monthly-archive.service -n 100 --no-pager
  exit 1
} || true

echo "== VERIFY =="
systemctl status softice-monthly-archive.timer --no-pager | sed -n '1,14p'
find "$ROOT/payments" "$ROOT/messages" -maxdepth 2 -type f \( -name '*.zip' -o -name '*.sha256' \) -printf '%p %s bytes\n' | sort
echo
echo "Last backup log:"
tail -n 3 "$ROOT/logs/monthly-backup.log" 2>/dev/null || true
echo
echo SOFTICE_MONTHLY_BACKUP_OK
