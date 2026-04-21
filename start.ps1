# Script para levantar el Sistema Escolar (Backend + Frontend)
# Uso: .\start.ps1   o   powershell -ExecutionPolicy Bypass -File .\start.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "  Levantando Sistema Escolar" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:5051" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:4001" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path "$root\backend\package.json")) {
    Write-Host "[ERROR] No se encuentra backend. Ejecuta desde la raiz del proyecto." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$root\frontend\school-app\package.json")) {
    Write-Host "[ERROR] No se encuentra frontend/school-app." -ForegroundColor Red
    exit 1
}

# Si existe concurrently en la raiz, usar npm run dev
if (Test-Path "$root\node_modules\concurrently") {
    Write-Host "Ejecutando backend y frontend (npm run dev)..." -ForegroundColor Green
    Set-Location $root
    npm run dev
    exit
}

# Si no, lanzar backend en segundo plano y frontend en primer plano
Write-Host "Iniciando Backend en segundo plano..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:root
    Set-Location backend
    npm run dev
}

Start-Sleep -Seconds 4

Write-Host "Iniciando Frontend..." -ForegroundColor Yellow
Set-Location "$root\frontend\school-app"
npm run dev

# Al salir del frontend (Ctrl+C), detener el job del backend
Stop-Job $backendJob
Remove-Job $backendJob
