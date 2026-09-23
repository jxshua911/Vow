param(
  [string]$OutputRoot = "$HOME\VOW-Production-Backups"
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_DB_URL) {
  throw "SUPABASE_DB_URL is required and must be supplied only through the environment."
}

if (-not $env:VOW_BACKUP_PASSPHRASE -or $env:VOW_BACKUP_PASSPHRASE.Length -lt 16) {
  throw "VOW_BACKUP_PASSPHRASE is required and must be at least 16 characters."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $OutputRoot "vow-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "Creating production database export in $backupDir"

supabase db dump --db-url "$env:SUPABASE_DB_URL" -f (Join-Path $backupDir "schema.sql")
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f (Join-Path $backupDir "data.sql") --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url "$env:SUPABASE_DB_URL" -f (Join-Path $backupDir "roles.sql") --role-only

$manifest = @{
  created_at = (Get-Date).ToUniversalTime().ToString("o")
  project_ref = "vqsrdausvmfjayffxiuh"
  database = "PostgreSQL 17"
  app_branch = "capacitor-mobile"
  backup_type = "logical_database_export"
  storage_backup = "required_separate_export"
} | ConvertTo-Json
$manifest | Set-Content -Encoding UTF8 (Join-Path $backupDir "manifest.json")

$archive = Join-Path $OutputRoot "vow-$timestamp.zip"
Compress-Archive -Path (Join-Path $backupDir "*") -DestinationPath $archive -CompressionLevel Optimal

$encrypted = "$archive.vowenc"
node (Join-Path $repoRoot "scripts\encrypt-backup.mjs") $archive $encrypted

Remove-Item -Force $archive
Remove-Item -Recurse -Force $backupDir

Write-Host ""
Write-Host "Encrypted production database export ready:"
Write-Host $encrypted
Write-Host ""
Write-Host "Storage objects are intentionally NOT included. Export the private goal-resources bucket separately, then encrypt that export with the same mechanism."
