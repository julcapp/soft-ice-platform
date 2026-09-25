[CmdletBinding()]
param(
  [ValidateSet('Fixture', 'Backup')]
  [string]$Mode = 'Fixture',

  [string]$AdminDatabaseUrl = $env:REHEARSAL_ADMIN_DATABASE_URL,

  [string]$DatabaseName = ('soft_ice_rehearsal_{0}' -f (Get-Date -Format 'yyyyMMdd_HHmmss')),

  [string]$BackupPath,

  [string]$AllowRemoteHost,

  [switch]$SkipApplicationVerification
)

$ErrorActionPreference = 'Stop'
$targetMigration = '20260923000100_catalog_price_reconciliation_v1'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$backendRoot = Join-Path $repoRoot 'backend'
$migrationRoot = Join-Path $backendRoot 'prisma\migrations'
$outputRoot = Join-Path $repoRoot ('.tmp\catalog-rehearsal\{0}' -f $DatabaseName)
$reportPath = Join-Path $outputRoot 'REHEARSAL_REPORT.md'

function Assert-Command([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) { throw "Required command is unavailable: $Name" }
  return $command.Source
}

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory)] [string]$Name,
    [Parameter(Mandatory)] [string]$FilePath,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$LogPath,
    [switch]$AllowFailure
  )
  "[$(Get-Date -Format o)] $Name" | Set-Content -Path $LogPath -Encoding utf8
  & $FilePath @Arguments 2>&1 |
    Tee-Object -FilePath $LogPath -Append |
    ForEach-Object { Write-Host $_ }
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "$Name failed with exit code $exitCode. See $LogPath"
  }
  return $exitCode
}

function Set-PostgresEnvironment([string]$Database) {
  $env:PGHOST = $script:adminUri.Host
  $env:PGPORT = [string]$script:adminUri.Port
  $env:PGUSER = $script:databaseUser
  $env:PGPASSWORD = $script:databasePassword
  $env:PGDATABASE = $Database
  $env:PGCONNECT_TIMEOUT = '10'
}

function Invoke-Psql {
  param(
    [Parameter(Mandatory)] [string]$Database,
    [string]$Sql,
    [string]$SqlFile,
    [string]$OutputPath
  )
  Set-PostgresEnvironment $Database
  $arguments = @('-X', '-v', 'ON_ERROR_STOP=1')
  if ($SqlFile) { $arguments += @('-f', $SqlFile) }
  else { $arguments += @('-c', $Sql) }
  if ($OutputPath) { $arguments += @('-o', $OutputPath) }
  & $script:psql @arguments
  if ($LASTEXITCODE -ne 0) { throw "psql failed for isolated database $Database" }
}

function Invoke-PsqlScalar([string]$Database, [string]$Sql) {
  Set-PostgresEnvironment $Database
  $value = & $script:psql -X -v ON_ERROR_STOP=1 -At -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql scalar query failed for isolated database $Database" }
  return ($value -join "`n").Trim()
}

function Save-DatabaseEvidence([string]$Phase) {
  $countsSql = @'
SELECT table_name, row_count
FROM (
  SELECT 'CatalogItem' AS table_name, count(*)::bigint AS row_count FROM "CatalogItem"
  UNION ALL SELECT 'MachineCatalogItem', count(*)::bigint FROM "MachineCatalogItem"
  UNION ALL SELECT 'PricingQuote', count(*)::bigint FROM "PricingQuote"
  UNION ALL SELECT 'PricingSnapshot', count(*)::bigint FROM "PricingSnapshot"
  UNION ALL SELECT 'PricingSnapshotItem', count(*)::bigint FROM "PricingSnapshotItem"
) counts
ORDER BY table_name;
'@
  $migrationSql = @'
SELECT "migration_name", COALESCE(to_char("finished_at", 'YYYY-MM-DD HH24:MI:SSOF'), 'NOT_FINISHED') AS finished_at
FROM "_prisma_migrations"
ORDER BY "started_at", "migration_name";
'@
  $fingerprintSql = @'
SELECT relation_name, row_count, fingerprint
FROM (
  SELECT 'PricingQuote' AS relation_name, count(*)::bigint AS row_count,
    COALESCE(md5(string_agg(to_jsonb(q)::text, '' ORDER BY q."id")), md5('')) AS fingerprint
  FROM "PricingQuote" q
  UNION ALL
  SELECT 'PricingSnapshot', count(*)::bigint,
    COALESCE(md5(string_agg(to_jsonb(s)::text, '' ORDER BY s."id")), md5(''))
  FROM "PricingSnapshot" s
  UNION ALL
  SELECT 'PricingSnapshotItem', count(*)::bigint,
    COALESCE(md5(string_agg(to_jsonb(i)::text, '' ORDER BY i."id")), md5(''))
  FROM "PricingSnapshotItem" i
) evidence
ORDER BY relation_name;
'@
  $nullPriceSql = @'
SELECT "id"
FROM "CatalogItem"
WHERE "basePrice" IS NULL
  AND "sku" NOT IN ('sprinkle_none', 'topping_none')
ORDER BY "id";
'@
  Invoke-Psql $DatabaseName -Sql $countsSql -OutputPath (Join-Path $outputRoot "$Phase-row-counts.txt")
  Invoke-Psql $DatabaseName -Sql $migrationSql -OutputPath (Join-Path $outputRoot "$Phase-migrations.txt")
  Invoke-Psql $DatabaseName -Sql $fingerprintSql -OutputPath (Join-Path $outputRoot "$Phase-pricing-fingerprints.txt")
  Invoke-Psql $DatabaseName -Sql $nullPriceSql -OutputPath (Join-Path $outputRoot "$Phase-null-price-ids.txt")
  Set-PostgresEnvironment $DatabaseName
  & $script:pgDump --schema-only --no-owner --no-privileges --file (Join-Path $outputRoot "$Phase-schema.sql")
  if ($LASTEXITCODE -ne 0) { throw "pg_dump schema snapshot failed for phase $Phase" }
}

if (-not $AdminDatabaseUrl) {
  throw 'Set REHEARSAL_ADMIN_DATABASE_URL to a non-production PostgreSQL admin database. The value is never written to the report.'
}
if ($DatabaseName -notmatch '^soft_ice_rehearsal_[a-zA-Z0-9_]+$') {
  throw 'DatabaseName must start with soft_ice_rehearsal_ and contain only letters, digits, and underscores.'
}

try { $adminUri = [Uri]$AdminDatabaseUrl }
catch { throw 'REHEARSAL_ADMIN_DATABASE_URL is not a valid PostgreSQL URL.' }
if ($adminUri.Scheme -notin @('postgres', 'postgresql')) { throw 'Only PostgreSQL URLs are supported.' }
$adminDatabase = $adminUri.AbsolutePath.TrimStart('/')
if (-not $adminDatabase) { throw 'Admin database name is missing from REHEARSAL_ADMIN_DATABASE_URL.' }
if ($adminUri.Host -match '(?i)(^|[.-])(prod|production)([.-]|$)' -or $adminDatabase -match '(?i)prod') {
  throw 'Production-looking host or database name is forbidden by the rehearsal harness.'
}
$localHosts = @('localhost', '127.0.0.1', '::1')
if ($adminUri.Host -notin $localHosts -and $AllowRemoteHost -ne $adminUri.Host) {
  throw "Remote host '$($adminUri.Host)' is denied. Pass -AllowRemoteHost with the exact approved non-production host."
}
$userInfo = $adminUri.UserInfo.Split(':', 2)
if (-not $userInfo[0]) { throw 'The admin URL must contain a PostgreSQL username.' }
if ($adminUri.Host -notin $localHosts -and ($userInfo.Count -ne 2 -or -not $userInfo[1])) {
  throw 'A remote non-production admin URL must contain a password; do not commit the URL.'
}
$databaseUser = [Uri]::UnescapeDataString($userInfo[0])
$databasePassword = if ($userInfo.Count -eq 2) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
$targetBuilder = [UriBuilder]$adminUri
$targetBuilder.Path = "/$DatabaseName"
$targetDatabaseUrl = $targetBuilder.Uri.AbsoluteUri

if ($Mode -eq 'Backup') {
  if (-not $BackupPath) { throw 'Backup mode requires -BackupPath.' }
  $BackupPath = (Resolve-Path $BackupPath).Path
}

$psql = Assert-Command 'psql'
$pgDump = Assert-Command 'pg_dump'
$pgRestore = Assert-Command 'pg_restore'
$npm = Assert-Command 'npm'
$prisma = Join-Path $backendRoot 'node_modules\.bin\prisma.cmd'
if (-not (Test-Path $prisma)) { throw 'Backend dependencies are missing. Run npm ci in backend before the rehearsal.' }

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$startedAt = Get-Date
$testResults = [ordered]@{}

try {
  Set-PostgresEnvironment $adminDatabase
  $serverVersion = Invoke-PsqlScalar $adminDatabase "SELECT current_setting('server_version');"
  $existing = Invoke-PsqlScalar $adminDatabase "SELECT count(*) FROM pg_database WHERE datname = '$DatabaseName';"
  if ($existing -ne '0') {
    throw "Database $DatabaseName already exists. Choose a new name; the harness never drops or resets databases."
  }
  Invoke-Psql $adminDatabase -Sql "CREATE DATABASE `"$DatabaseName`" WITH TEMPLATE template0 ENCODING 'UTF8';"

  if ($Mode -eq 'Fixture') {
    $stageRoot = Join-Path $outputRoot 'pre-target-prisma'
    $stagePrisma = Join-Path $stageRoot 'prisma'
    $stageMigrations = Join-Path $stagePrisma 'migrations'
    New-Item -ItemType Directory -Path $stageMigrations -Force | Out-Null
    Copy-Item (Join-Path $backendRoot 'prisma\schema.prisma') (Join-Path $stagePrisma 'schema.prisma')
    Copy-Item (Join-Path $migrationRoot 'migration_lock.toml') (Join-Path $stageMigrations 'migration_lock.toml')
    Get-ChildItem $migrationRoot -Directory |
      Where-Object { $_.Name -lt $targetMigration } |
      Sort-Object Name |
      ForEach-Object { Copy-Item $_.FullName (Join-Path $stageMigrations $_.Name) -Recurse }
    $env:DATABASE_URL = $targetDatabaseUrl
    Invoke-LoggedCommand -Name 'canonical pre-target migration chain' -FilePath $prisma -Arguments @('migrate', 'deploy', "--schema=$(Join-Path $stagePrisma 'schema.prisma')") -LogPath (Join-Path $outputRoot 'pre-target-migrate.log') | Out-Null
    Invoke-Psql $DatabaseName -SqlFile (Join-Path $PSScriptRoot 'fixture-pre-target.sql')
  } else {
    Set-PostgresEnvironment $DatabaseName
    & $pgRestore --list $BackupPath *> (Join-Path $outputRoot 'backup-contents.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backup is not a readable PostgreSQL custom-format archive.' }
    Invoke-LoggedCommand -Name 'production-shaped backup restore' -FilePath $pgRestore -Arguments @('--exit-on-error', '--no-owner', '--no-privileges', '--dbname', $DatabaseName, $BackupPath) -LogPath (Join-Path $outputRoot 'backup-restore.log') | Out-Null
    $alreadyApplied = Invoke-PsqlScalar $DatabaseName "SELECT count(*) FROM `"_prisma_migrations`" WHERE `"migration_name`" = '$targetMigration' AND `"finished_at`" IS NOT NULL;"
    if ($alreadyApplied -ne '0') { throw "Backup already contains $targetMigration; a pre-target backup is required." }
  }

  Save-DatabaseEvidence 'before'

  $env:DATABASE_URL = $targetDatabaseUrl
  Invoke-LoggedCommand -Name 'full canonical migration chain' -FilePath $prisma -Arguments @('migrate', 'deploy', "--schema=$(Join-Path $backendRoot 'prisma\schema.prisma')") -LogPath (Join-Path $outputRoot 'full-migrate.log') | Out-Null
  Save-DatabaseEvidence 'after'

  $beforeFingerprints = (Get-Content -Raw (Join-Path $outputRoot 'before-pricing-fingerprints.txt')).Trim()
  $afterFingerprints = (Get-Content -Raw (Join-Path $outputRoot 'after-pricing-fingerprints.txt')).Trim()
  if ($beforeFingerprints -ne $afterFingerprints) { throw 'Historical PricingQuote/PricingSnapshot fingerprints changed during migration.' }
  $beforeNulls = (Get-Content -Raw (Join-Path $outputRoot 'before-null-price-ids.txt')).Trim()
  $afterNulls = (Get-Content -Raw (Join-Path $outputRoot 'after-null-price-ids.txt')).Trim()
  if ($beforeNulls -ne $afterNulls) { throw 'The set of null-price catalog rows changed during migration.' }

  Invoke-Psql $DatabaseName -SqlFile (Join-Path $PSScriptRoot 'assert-post-migration.sql') -OutputPath (Join-Path $outputRoot 'constraints.txt')

  if (-not $SkipApplicationVerification) {
    Push-Location $backendRoot
    try {
      $env:DATABASE_URL = $targetDatabaseUrl
      $testResults['Backend full test suite'] = Invoke-LoggedCommand -Name 'backend full test suite' -FilePath $npm -Arguments @('test') -LogPath (Join-Path $outputRoot 'backend-tests.log') -AllowFailure
    } finally { Pop-Location }

    Push-Location (Join-Path $repoRoot 'frontend\admin-console')
    try {
      $testResults['Admin Console tests'] = Invoke-LoggedCommand -Name 'Admin Console tests' -FilePath $npm -Arguments @('test') -LogPath (Join-Path $outputRoot 'admin-tests.log') -AllowFailure
      $testResults['Admin Console build'] = Invoke-LoggedCommand -Name 'Admin Console build' -FilePath $npm -Arguments @('run', 'build') -LogPath (Join-Path $outputRoot 'admin-build.log') -AllowFailure
    } finally { Pop-Location }

    Push-Location (Join-Path $repoRoot 'frontend\miniapp')
    try {
      $testResults['Mini App/display build'] = Invoke-LoggedCommand -Name 'Mini App/display build' -FilePath $npm -Arguments @('run', 'build') -LogPath (Join-Path $outputRoot 'miniapp-build.log') -AllowFailure
    } finally { Pop-Location }
  }

  $failedChecks = @($testResults.GetEnumerator() | Where-Object Value -ne 0)
  $goStatus = if ($Mode -eq 'Backup' -and $failedChecks.Count -eq 0 -and -not $SkipApplicationVerification) { 'GO candidate; requires human review and separate release approval' } else { 'NO-GO' }
  $testLines = if ($SkipApplicationVerification) { '- Application verification: SKIPPED (NO-GO)' } else {
    @($testResults.GetEnumerator() | ForEach-Object { '- {0}: {1}' -f $_.Key, $(if ($_.Value -eq 0) { 'PASS' } else { "FAIL (exit $($_.Value))" }) }) -join "`n"
  }
  $issues = @()
  if ($Mode -eq 'Fixture') { $issues += '- No real production-shaped backup was used; fixture evidence cannot authorize production release.' }
  if ($failedChecks.Count) { $issues += '- One or more application verification commands failed; inspect the generated logs.' }
  if ($SkipApplicationVerification) { $issues += '- Full application verification was explicitly skipped.' }
  if (-not $issues.Count) { $issues += '- No harness-detected migration or test failures.' }

  $report = @"
# Catalog / price / display migration rehearsal report

- Started: $($startedAt.ToString('o'))
- Finished: $((Get-Date).ToString('o'))
- Mode: $Mode
- Isolated database: $DatabaseName
- PostgreSQL server: $serverVersion
- Target migration: $targetMigration
- Decision: **$goStatus**

## Migrations before

``````text
$(Get-Content -Raw (Join-Path $outputRoot 'before-migrations.txt'))
``````

## Migrations after

``````text
$(Get-Content -Raw (Join-Path $outputRoot 'after-migrations.txt'))
``````

## Row counts before

``````text
$(Get-Content -Raw (Join-Path $outputRoot 'before-row-counts.txt'))
``````

## Row counts after

``````text
$(Get-Content -Raw (Join-Path $outputRoot 'after-row-counts.txt'))
``````

## Constraint and preservation results

- Protected sprinkle_none and topping_none: PASS (explicit 0 RUB, active system items).
- Null-price identity set unchanged: PASS.
- Historical PricingQuote, PricingSnapshot, PricingSnapshotItem row fingerprints unchanged: PASS.
- Current flavor uniqueness and validity: PASS.
- Invalid active-null and unmarked-zero inserts rejected: PASS.

See constraints.txt, schema snapshots, fingerprints, and migration logs in this evidence directory.

## Tests and builds

$testLines

Backend coverage includes server-authoritative price resolution, add-ons, Promotion Engine, machine-specific current flavors, and historical snapshot immutability. Admin Console coverage includes bulk save, dirty state, validation/API failure retention, and customer preview.

## Problems found

$($issues -join "`n")

## Rollback / restore plan

1. Do not alter this rehearsal database after a failed migration; retain it with its evidence directory.
2. Create another new soft_ice_rehearsal_* database. Never reset, truncate, or drop the failed copy.
3. Restore the same verified pre-target custom-format backup into the new database.
4. Point only the isolated rehearsal runtime at the restored database and verify its migration list and row fingerprints.
5. For a future production release, stop before migration on any NO-GO item. Production rollback requires a separately approved restore into a new database/cluster and controlled application cutback; this harness never mutates production.

## Future production GO / NO-GO checklist

- [ ] A fresh, encrypted, checksum-verified pre-target production-shaped backup was restored in an access-controlled non-production environment.
- [ ] Backup contains `_prisma_migrations`, all schemas, and all data needed for referential/constraint validation.
- [ ] Before/after schema, migrations, row counts, null-price identities, and pricing fingerprints were reviewed.
- [ ] All catalog and machine-catalog constraints are validated.
- [ ] Protected no-option rows are exactly 0 RUB and system-protected.
- [ ] Different machines retain their own current flavor.
- [ ] Historical quote/snapshot evidence is byte-logically unchanged.
- [ ] Admin bulk save, dirty state, validation failure, and customer preview pass.
- [ ] Server-authoritative pricing, add-ons, and Promotion Engine pass.
- [ ] Full backend suite, Admin Console tests/build, and Mini App/display build pass.
- [ ] No real payment or physical dispense was invoked.
- [ ] Restore/cutback drill was reviewed by the release owner.
- [ ] Product Owner gave separate production release approval.
"@
  Set-Content -Path $reportPath -Value $report -Encoding utf8
  Write-Host "Rehearsal report: $reportPath"
  if ($goStatus -eq 'NO-GO') { exit 2 }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
