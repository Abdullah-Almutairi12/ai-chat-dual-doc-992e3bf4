# Deploy PDF Quanta Supabase edge functions (Windows)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$Supabase = Join-Path $ProjectRoot ".bin\supabase-cli\supabase.exe"
$ProjectRef = "iwigbzxvjvoqkvuxjhxi"

if (-not (Test-Path $Supabase)) {
  Write-Host "Supabase CLI not found. Run: npm install" -ForegroundColor Yellow
  Write-Host "Or download: https://github.com/supabase/cli/releases" -ForegroundColor Yellow
  exit 1
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Not logged in. Run one of:" -ForegroundColor Yellow
  Write-Host "  supabase login"
  Write-Host "  `$env:SUPABASE_ACCESS_TOKEN = '<token from https://supabase.com/dashboard/account/tokens>'"
  exit 1
}

& $Supabase functions deploy send-welcome tap-renew --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Set function secrets in Supabase Dashboard -> Edge Functions -> Secrets:" -ForegroundColor Cyan
Write-Host "  CRON_SECRET, RESEND_API_KEY, TAP_SECRET_KEY, APP_ORIGIN"
Write-Host ""
Write-Host "Function URLs:" -ForegroundColor Cyan
Write-Host "  https://$ProjectRef.supabase.co/functions/v1/send-welcome"
Write-Host "  https://$ProjectRef.supabase.co/functions/v1/tap-renew"
