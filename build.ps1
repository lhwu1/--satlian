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
  if (Get-Command cargo-tauri -ErrorAction SilentlyContinue) {
    cargo tauri build --manifest-path (Join-Path $Root '练枪靶场/src-tauri/Cargo.toml')
    $bundle = Join-Path $Root '练枪靶场/src-tauri/target/release/bundle'
    if (Test-Path $bundle) { Get-ChildItem $bundle -Recurse -File | Where-Object { $_.Extension -in '.exe','.msi' } | Copy-Item -Destination $Out -Force }
  } else {
    Write-Warning 'cargo-tauri unavailable; building runnable release executable with cargo'
    cargo build --release --manifest-path (Join-Path $Root '练枪靶场/src-tauri/Cargo.toml')
    Copy-Item (Join-Path $Root '练枪靶场/src-tauri/target/release/saltline-range.exe') (Join-Path $Out '沿线战术工作台.exe') -Force
  }
} else { Write-Host '[3/4] desktop bundle skipped' }
Write-Host '[resources] copy editor runtime beside desktop executable'
foreach ($dir in @('编辑器','素材','地图')) { Copy-Item (Join-Path $Root $dir) (Join-Path $Out $dir) -Recurse -Force }
foreach ($file in @('package.json','index.html')) { Copy-Item (Join-Path $Root $file) (Join-Path $Out $file) -Force }
Write-Host '[4/4] artifacts are in dist'
Write-Host ('done: ' + $Out)
