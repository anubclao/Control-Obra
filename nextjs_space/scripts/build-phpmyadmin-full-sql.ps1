param(
  [string]$OutputFile = "sql/control_obra_full_phpmyadmin.sql"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$outputPath = Join-Path $root $OutputFile
$outputDir = Split-Path -Parent $outputPath
if (!(Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$tempSchema = Join-Path $env:TEMP "control_obra_schema_generated.sql"

Write-Host "[1/4] Generando esquema base desde Prisma..."
$npxCmd = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npxCmd) {
  throw "No se encontro npx.cmd en PATH"
}

& npx.cmd prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | Out-File -FilePath $tempSchema -Encoding utf8

if (!(Test-Path $tempSchema)) {
  throw "No se genero el schema SQL temporal"
}

$parts = @(
  "migrations/add_access_control_roles.sql",
  "migrations/add_access_control_db_objects.sql",
  "../database/mysql/functions.sql",
  "../database/mysql/triggers.sql",
  "../database/mysql/procedures.sql",
  "../database/mysql/views.sql"
)

Write-Host "[2/4] Componiendo SQL consolidado..."
$header = @(
  "-- =============================================",
  "-- CONTROL OBRA - SQL FULL PARA PHPMYADMIN",
  "-- Generado automaticamente",
  "-- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "-- =============================================",
  "",
  "-- IMPORTANTE:",
  "-- 1) Crear previamente la base en phpMyAdmin (ej: control_obra_db)",
  "-- 2) Seleccionar esa base antes de importar este archivo",
  "-- 3) Si tu hosting restringe CREATE FUNCTION/TRIGGER/PROCEDURE,",
  "--    esas sentencias pueden fallar por permisos.",
  "",
  "SET NAMES utf8mb4;",
  "SET FOREIGN_KEY_CHECKS = 0;",
  ""
)

$footer = @(
  "",
  "SET FOREIGN_KEY_CHECKS = 1;",
  "-- FIN DEL SCRIPT"
)

$header | Out-File -FilePath $outputPath -Encoding utf8
Get-Content $tempSchema | Add-Content -Path $outputPath

foreach ($relativePart in $parts) {
  $partPath = Join-Path $root $relativePart
  if (Test-Path $partPath) {
    "`n-- =============================================" | Add-Content -Path $outputPath
    "-- SOURCE: $relativePart" | Add-Content -Path $outputPath
    "-- =============================================`n" | Add-Content -Path $outputPath
    Get-Content $partPath | Add-Content -Path $outputPath
  }
}

$footer | Add-Content -Path $outputPath

Write-Host "[3/4] Limpiando temporales..."
Remove-Item -Path $tempSchema -Force -ErrorAction SilentlyContinue

Write-Host "[4/4] Listo: $outputPath"
