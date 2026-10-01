Set-Location D:\desarrollos\ControlObra\ControlObra\nextjs_space
& npx vitest run --reporter=verbose 2>&1 | Tee-Object -FilePath vitest.log | Out-Null
$code = $LASTEXITCODE
Write-Host "=== EXIT $code ==="
# Mostrar solo las últimas 30 líneas (resumen)
$lines = Get-Content vitest.log
$tail = $lines | Select-Object -Last 30
$tail | ForEach-Object { Write-Host $_ }
Remove-Item vitest.log -Force -ErrorAction SilentlyContinue
