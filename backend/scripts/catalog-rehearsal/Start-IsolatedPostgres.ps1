[CmdletBinding()]
param(
  [int]$Port = 55432,
  [string]$DatabaseUser = 'rehearsal_admin',
  [string]$DataDirectory
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
if (-not $DataDirectory) { $DataDirectory = Join-Path $repoRoot '.tmp\catalog-rehearsal\postgres-16-cluster' }
$postgresBin = Split-Path (Get-Command psql -ErrorAction Stop).Source
$initdb = Join-Path $postgresBin 'initdb.exe'
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$pgIsReady = Join-Path $postgresBin 'pg_isready.exe'
foreach ($tool in @($initdb, $pgCtl, $pgIsReady)) {
  if (-not (Test-Path $tool)) { throw "PostgreSQL tool is unavailable: $tool" }
}
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Use an unprivileged TCP port between 1024 and 65535.' }
if ($DatabaseUser -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$') { throw 'DatabaseUser is not a safe PostgreSQL identifier.' }

$versionFile = Join-Path $DataDirectory 'PG_VERSION'
if (-not (Test-Path $versionFile)) {
  if (Test-Path $DataDirectory) {
    $entries = @(Get-ChildItem $DataDirectory -Force)
    if ($entries.Count) { throw "Refusing to initialize into non-empty directory: $DataDirectory" }
  }
  New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null
  & $initdb -D $DataDirectory -U $DatabaseUser --encoding=UTF8 --locale=C --auth-local=trust --auth-host=trust
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
}

& $pgCtl -D $DataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $DataDirectory -l (Join-Path $DataDirectory 'postgres.log') -o "-p $Port -h 127.0.0.1" -w start
  if ($LASTEXITCODE -ne 0) { throw 'The isolated PostgreSQL cluster did not start.' }
}

& $pgIsReady -h 127.0.0.1 -p $Port -U $DatabaseUser -d postgres
if ($LASTEXITCODE -ne 0) { throw 'The isolated PostgreSQL cluster is not ready.' }

$url = "postgresql://$DatabaseUser@127.0.0.1:$Port/postgres"
Write-Output "Isolated PostgreSQL is ready."
Write-Output "Data directory: $DataDirectory"
Write-Output "Set for this PowerShell session:"
Write-Output "`$env:REHEARSAL_ADMIN_DATABASE_URL = '$url'"
