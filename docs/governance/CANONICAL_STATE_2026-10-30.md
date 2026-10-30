# Canonical Soft_ICE state — 2026-10-30

## Source of truth

The authoritative source for Soft_ICE is the GitHub repository `julcapp/soft-ice-platform`.

Production servers are deployment targets, not development sources. Home-Boss and BOSS-2 are working copies. No production deployment should depend on uncommitted server-only changes after normalization is complete.

## Recovery / normalization inputs

### Current cloud baseline
- `main`: current cloud baseline before consolidation.
- `canonical/soft-ice-20261030`: consolidation branch.

### Preserved BOSS-2 work
- `feature/administrator-security-v1-20261030`
- preserved commit: `55e6b71`
- branch is published in GitHub
- contains administrator identity/session/authorization/security/audit work, migrations, tests and admin client changes.
- temporary PostgreSQL files under `.tmp/` are intentionally excluded.

### Production server snapshot
- branch: `snapshot/production-server-20261030`
- snapshot commit: `96567bb12eb485b78d486f4b7c2035247b93cdaa`
- parent server hotfix: `ee99622f1d8877b0f027f2fbb26d2dfec8dcef1c`
- source runtime worktree: `/home/julcapp/soft-ice-worktrees/display-product-v1`
- snapshot preserved 177 files from the live server state after secret scanning; reviewed untracked production source/assets were included.
- the complete Git history was exported as a verified bundle and imported into GitHub, so the former server-only history now exists in the cloud.

## Known synchronization risks

- Home-Boss local `main` was observed behind `origin/main` by 42 commits.
- BOSS-2 local `main` was observed behind `origin/main` by 42 commits before Administrator Security was preserved.
- `test/terminal-yookassa-card` on Home-Boss was observed both ahead and behind its remote and had local modifications.
- production server worktrees contain substantial uncommitted changes; do not run mass `git pull`, `reset --hard`, or rebase on them before snapshot preservation.
- server `integration/unified-v0.36.0` was observed behind cloud by 26 commits.
- server and cloud branches named `hotfix/display-bonus-zero-fallback-20261029` currently do not point to the same history.

## Production runtime observations

- `display.utimoshi.ru` backend: `softice-display-backend-8800.service`
- runtime directory: `/home/julcapp/soft-ice-worktrees/display-product-v1/backend`
- PostgreSQL container: `utimoshi_postgres`
- nginx/systemd runtime was healthy at audit time; no failed systemd units were reported.
- public HTTPS endpoints responding at audit time: `utimoshi.ru`, `display.utimoshi.ru`, `admin.utimoshi.ru`, `miniapp.utimoshi.ru`, `terminal.utimoshi.ru`, `app.utimoshi.ru`.
- planned production endpoints `api.utimoshi.ru`, `tehnik.utimoshi.ru`, `master.utimoshi.ru` were not yet available as working HTTPS endpoints.

## Consolidation order

1. Preserve production server state in `snapshot/production-server-20261030`.
2. Preserve all PC-only feature work in dedicated branches.
3. Compare server snapshot, Administrator Security, and current `main`.
4. Merge/reconcile into this canonical branch with tests.
5. Promote the tested canonical branch to `main`.
6. Re-clone or fast-forward Home-Boss and BOSS-2 from the new `main`.
7. Re-deploy production from an immutable Git commit/tag.
8. Stop direct uncommitted development on the production server.

## Safety invariants

- Never dispense before server-confirmed payment success.
- Never blindly repeat an ambiguous machine dispense command.
- Keep financial, fiscal and audit history immutable.
- Never commit production secrets, credentials, private keys or runtime environment files.


## Consolidation progress

- [x] Cloud canonical branch created.
- [x] BOSS-2 Administrator Security preserved and pushed.
- [x] Live production server state preserved as a clean snapshot commit.
- [x] Production server snapshot imported and pushed to GitHub with complete history.
- [ ] Reconcile Administrator Security onto current canonical baseline. Initial cherry-pick shows six content conflicts: backend API index plus five admin API clients; all other files merge automatically.
- [ ] Reconcile production snapshot tree with current cloud main/canonical.
- [ ] Preserve remaining Home-Boss-only dirty worktrees after the workstation is reachable.
- [ ] Promote tested consolidated canonical state to main.
- [ ] Re-sync both PCs from canonical main and deploy immutable production commit/tag.


## Canonical reconciliation pull requests

- PR #28 — `snapshot/production-server-20261030` → `canonical/soft-ice-20261030`. Draft, intentionally not directly mergeable.
- PR #29 — `feature/administrator-security-v1-20261030` → `canonical/soft-ice-20261030`. Draft, six known content conflicts from initial local reconciliation attempt.
