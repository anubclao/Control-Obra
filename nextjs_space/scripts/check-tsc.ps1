Set-Location D:\desarrollos\ControlObra\ControlObra\nextjs_space
& npx tsc --noEmit 2>&1 | Tee-Object -FilePath tsc.log | Out-Null
$code = $LASTEXITCODE
Write-Host "=== EXIT $code ==="
if ((Get-Item tsc.log).Length -eq 0) {
  Write-Host "(no errors)"
} else {
  Get-Content tsc.log
}
Remove-Item tsc.log -Force -ErrorAction SilentlyContinue
