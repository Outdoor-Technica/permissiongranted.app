$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $projectRoot ".dev.vars"

if (Test-Path -LiteralPath $target) {
  throw ".dev.vars already exists. Remove it manually if you intend to regenerate local secrets."
}

function New-RandomBase64([int]$byteCount) {
  $bytes = New-Object byte[] $byteCount
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes)
}

$encryptionKey = New-RandomBase64 32
$emailHmacKey = New-RandomBase64 48
$confirmationHmacKey = New-RandomBase64 48

$content = @"
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
DATA_ENCRYPTION_KEY=$encryptionKey
EMAIL_HMAC_KEY=$emailHmacKey
CONFIRMATION_HMAC_KEY=$confirmationHmacKey
EMAIL_MODE=preview
"@

Set-Content -LiteralPath $target -Value $content -Encoding utf8NoBOM
Write-Host "Created $target with local-only random secrets and email preview mode."
