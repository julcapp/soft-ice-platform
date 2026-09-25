[CmdletBinding()]
param([string]$DataDirectory)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
if (-not $DataDirectory) { $DataDirectory = Join-Path $repoRoot '.tmp\catalog-rehearsal\postgres-16-cluster' }
$resolved = (Resolve-Path $DataDirectory).Path
$expectedRoot = (Resolve-Path (Join-Path $repoRoot '.tmp\catalog-rehearsal')).Path
if (-not $resolved.StartsWith($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to stop a PostgreSQL cluster outside .tmp/catalog-rehearsal.'
}
$postgresBin = Split-Path (Get-Command psql -ErrorAction Stop).Source
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
& $pgCtl -D $resolved -w stop -m fast
if ($LASTEXITCODE -ne 0) { throw 'The isolated PostgreSQL cluster did not stop cleanly.' }
Write-Output "Isolated PostgreSQL stopped. Data was retained at $resolved"
