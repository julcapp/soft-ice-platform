# Soft ICE production runtime and deploy access

## Accounts
- `julcapp` — normal SSH login, deployment and operational administration.
- `softice` — locked system account with `/usr/sbin/nologin`; runs production backend only.
- `root` — operating-system administration only.

Do not enable SSH login for `softice` and do not make `julcapp` a root account.

## Groups
- `softice-deploy` — deploy operators; `julcapp` is a member.
- `softice-runtime` — runtime read/execute group; primary group of `softice`.
- `softice-config` — protected configuration readers; `julcapp` and `softice`.

## Production backend
Unit: `softice-display-backend-8800.service`.

Systemd drop-in:
`/etc/systemd/system/softice-display-backend-8800.service.d/10-runtime-user.conf`

Backend runtime identity: `softice:softice-runtime`.

Working tree:
`/home/julcapp/soft-ice-worktrees/display-product-v1/backend`

Application source under `backend/src` is owned by `julcapp` and read-only for the runtime group.

Runtime uploads:
`/var/lib/soft-ice/media/service-reports`

Environment file:
`/etc/softice/display-backend.env`

Expected owner/group/mode: `root:softice-config 0640`.

## Operational sudo
`julcapp` remains the normal SSH account. Restricted passwordless sudo is allowed only for:
- restart/status `softice-display-backend-8800.service`
- start/status `softice-monthly-archive.service`
- status `softice-monthly-archive.timer`

Never configure blanket `NOPASSWD: ALL`.

Full OS administration remains password-protected via explicit `sudo su`.

## Monthly archive
Timer: `softice-monthly-archive.timer`.

Schedule: first day of each month, 00:20 Asia/Tomsk.

Archive root:
`/home/julcapp/softice-backups`

Scheduler reads the monthly backup log but does not need write access to archive storage.

## Security principle
Human/deploy identity and runtime identity are separated. A compromise of the public backend process must not grant SSH access, root access, or permission to modify deployed code.

[executed on device: Home-Boss (3edc2642-7822-40ad-8421-dfa47fe2a398)]