#!/usr/bin/env bash
set -euo pipefail

SERVICE=softice-display-backend-8800.service
PROD=/home/julcapp/soft-ice-worktrees/display-product-v1
BACKEND="$PROD/backend"
DROPIN_DIR=/etc/systemd/system/$SERVICE.d
DROPIN="$DROPIN_DIR/10-runtime-user.conf"
ENV_FILE=/etc/softice/display-backend.env
SUDOERS=/etc/sudoers.d/softice-julcapp
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STATE=/root/softice-runtime-migration-$STAMP

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root"
  exit 2
fi

mkdir -p "$STATE"
cp -a "$DROPIN_DIR" "$STATE/service-dropins" 2>/dev/null || true
cp -a "$SUDOERS" "$STATE/sudoers.bak" 2>/dev/null || true
stat -c '%a %U %G %n' /home/julcapp > "$STATE/home-perms.txt"
stat -c '%a %U %G %n' "$ENV_FILE" > "$STATE/env-perms.txt"

rollback_service() {
  echo "ROLLBACK: restoring root runtime for $SERVICE"
  rm -f "$DROPIN"
  if [ -d "$STATE/service-dropins" ]; then
    cp -a "$STATE/service-dropins/." "$DROPIN_DIR/"
  fi
  systemctl daemon-reload
  systemctl restart "$SERVICE" || true
}
trap 'echo "ERROR: migration failed"; rollback_service' ERR

echo "== GROUPS =="
getent group softice-deploy >/dev/null || groupadd softice-deploy
getent group softice-runtime >/dev/null || groupadd --system softice-runtime
getent group softice-config >/dev/null || groupadd --system softice-config

usermod -aG softice-deploy,softice-config julcapp

echo "== RUNTIME USER =="
if ! id softice >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir /var/lib/soft-ice \
    --gid softice-runtime --shell /usr/sbin/nologin softice
fi
usermod -g softice-runtime -aG softice-config softice
passwd -l softice >/dev/null 2>&1 || true

echo "== CONFIG ACCESS =="
chown root:softice-config "$ENV_FILE"
chmod 640 "$ENV_FILE"

echo "== CODE ACCESS =="
# Allow the runtime user to traverse julcapp home without listing it.
chmod 751 /home/julcapp

# julcapp owns deployable application source; runtime group can only read/execute.
chown -R julcapp:softice-runtime "$BACKEND/src"
chmod -R u+rwX,g+rX,g-w,o-rwx "$BACKEND/src"

# Runtime dependencies remain immutable; ensure they are readable/traversable.
chgrp -R softice-runtime "$BACKEND/node_modules"
chmod -R g+rX,g-w "$BACKEND/node_modules"

for f in package.json package-lock.json; do
  if [ -f "$BACKEND/$f" ]; then
    chown julcapp:softice-runtime "$BACKEND/$f"
    chmod 640 "$BACKEND/$f"
  fi
done

echo "== WRITABLE RUNTIME DATA =="
install -d -m 750 -o softice -g softice-runtime /var/lib/soft-ice/media/service-reports

# Scheduler only needs read access to its backup execution log.
if [ -d /home/julcapp/softice-backups ]; then
  chgrp softice-runtime /home/julcapp/softice-backups
  chmod 750 /home/julcapp/softice-backups
fi
if [ -d /home/julcapp/softice-backups/logs ]; then
  chgrp -R softice-runtime /home/julcapp/softice-backups/logs
  find /home/julcapp/softice-backups/logs -type d -exec chmod 750 {} +
  find /home/julcapp/softice-backups/logs -type f -exec chmod 640 {} +
fi

echo "== PRECHECK AS softice =="
runuser -u softice -- test -r "$BACKEND/src/main.js"
runuser -u softice -- test -r "$ENV_FILE"
runuser -u softice -- bash -c "cd '$BACKEND' && /usr/bin/node --check src/main.js"
runuser -u softice -- bash -c "cd '$BACKEND' && /usr/bin/node -e \"require('express');require('@prisma/client');console.log('RUNTIME_MODULES_OK')\""

echo "== SYSTEMD DROP-IN =="
install -d -m 755 "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF'
[Service]
User=softice
Group=softice-runtime
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
EOF
chmod 644 "$DROPIN"

echo "== LIMITED PASSWORDLESS SUDO =="
SYSTEMCTL="$(command -v systemctl)"
cat > "$SUDOERS.tmp" <<EOF
Cmnd_Alias SOFTICE_RUNTIME = \
  $SYSTEMCTL restart softice-display-backend-8800.service, \
  $SYSTEMCTL status softice-display-backend-8800.service, \
  $SYSTEMCTL start softice-monthly-archive.service, \
  $SYSTEMCTL status softice-monthly-archive.service, \
  $SYSTEMCTL status softice-monthly-archive.timer

%softice-deploy ALL=(root) NOPASSWD: SOFTICE_RUNTIME
EOF
chmod 440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp"
mv "$SUDOERS.tmp" "$SUDOERS"

echo "== RESTART =="
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE"

MAINPID="$(systemctl show "$SERVICE" -p MainPID --value)"
OWNER="$(ps -o user= -p "$MAINPID" | xargs)"
if [ "$OWNER" != "softice" ]; then
  echo "ERROR: backend owner is $OWNER, expected softice"
  false
fi

curl -fsS http://127.0.0.1:8800/api/v1/ >/tmp/softice-runtime-health.json

echo "== VERIFY SUDOERS =="
runuser -u julcapp -- sudo -n "$SYSTEMCTL" status "$SERVICE" >/dev/null

trap - ERR
echo "SOFTICE_RUNTIME_MIGRATION_OK"
echo "service_user=$OWNER"
echo "main_pid=$MAINPID"
echo "state_backup=$STATE"
