param([switch]$SkipDesktop)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$Out = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force $Out | Out-Null
Write-Host '[1/4] build editor'
npm.cmd run build
Write-Host '[2/4] build range backend'
Push-Location (Join-Path $Root '练枪靶场')
python -m PyInstaller --noconfirm backend-service.spec
Pop-Location
if (-not $SkipDesktop) {
  Write-Host '[3/4] build desktop bundle'
  cargo tauri build --manifest-path (Join-Path $Root '练枪靶场/src-tauri/Cargo.toml')
  $bundle = Join-Path $Root '练枪靶场/src-tauri/target/release/bundle'
  if (Test-Path $bundle) { Get-ChildItem $bundle -Recurse -File | Where-Object { $_.Extension -in '.exe','.msi' } | Copy-Item -Destination $Out -Force }
} else { Write-Host '[3/4] desktop bundle skipped' }
Write-Host '[4/4] artifacts are in dist'
Write-Host ('done: ' + $Out)
