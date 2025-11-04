<#
  Script: scripts/start-local.ps1
  Descripción:
    - Prepara entorno local (Windows PowerShell)
    - Crea base de datos (si no existe) y aplica migraciones
    - Crea/actualiza usuario admin de prueba
    - Levanta backend y frontend en ventanas separadas

  Uso (PowerShell):
    # Ejecutar desde la carpeta backend/
    # Opcionalmente personaliza parámetros
    # .\scripts\start-local.ps1 -DbName "school_system" -DbUser "postgres" -DbPassword "tu_password" -AdminEmail "admin@test.com" -AdminPassword "Admin123!"

  Requisitos:
    - PostgreSQL instalado y accesible con psql
    - Node.js 18+ y npm
    - Frontend ubicado en ..\frontend\school-app
#>

param(
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [string]$DbName = "school_system",
  [string]$DbUser = "postgres",
  [string]$DbPassword = "",
  [string]$AdminEmail = "admin@test.com",
  [string]$AdminPassword = "Admin123!",
  [switch]$UseDatabaseUrl,
  [string]$DatabaseUrl
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }

# 1) Validaciones iniciales
Write-Info "Verificando herramientas..."
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Err "psql no está en el PATH. Instala PostgreSQL o agrega psql al PATH."
  exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Err "npm no está en el PATH. Instala Node.js."
  exit 1
}

# Establecer ubicación a la carpeta backend del script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir\.. | Out-Null

# 2) Instalar dependencias backend
Write-Info "Instalando dependencias del backend..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Err "Fallo npm install en backend"; exit 1 }

# 3) Preparar DB: crear si no existe y migrar
if ($UseDatabaseUrl -or $DatabaseUrl) {
  if (-not $DatabaseUrl) {
    $DatabaseUrl = $env:DATABASE_URL
  }
  if (-not $DatabaseUrl) {
    Write-Err "UseDatabaseUrl está activo, pero DATABASE_URL no fue provisto."
    exit 1
  }
  Write-Info "Aplicando migraciones con DATABASE_URL..."
  $env:DATABASE_URL = $DatabaseUrl
  npm run db:migrate:url
  if ($LASTEXITCODE -ne 0) { Write-Err "Fallo migración con DATABASE_URL"; exit 1 }
} else {
  Write-Info "Creando base de datos si no existe ($DbName)..."
  $env:PGPASSWORD = $DbPassword
  $dbExists = psql -U $DbUser -h $DbHost -p $DbPort -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>$null
  if (-not $dbExists) { $dbExists = "" }
  if ($dbExists.Trim() -ne "1") {
    Write-Info "Creando base de datos $DbName..."
    psql -U $DbUser -h $DbHost -p $DbPort -c "CREATE DATABASE $DbName;"
    if ($LASTEXITCODE -ne 0) { Write-Err "Fallo creando la base de datos"; exit 1 }
  } else {
    Write-Ok "La base $DbName ya existe"
  }
  Write-Info "Aplicando migraciones locales..."
  psql -U $DbUser -h $DbHost -p $DbPort -d $DbName -f .\database\schema.sql
  if ($LASTEXITCODE -ne 0) { Write-Err "Fallo aplicando schema.sql"; exit 1 }
}
Write-Ok "Migraciones aplicadas"

# 4) Sembrar/actualizar admin
Write-Info "Creando/actualizando usuario admin..."
$env:ADMIN_EMAIL = $AdminEmail
$env:ADMIN_PASSWORD = $AdminPassword
$env:NODE_ENV = "development"
node .\scripts\createAdmin.js
if ($LASTEXITCODE -ne 0) { Write-Err "Fallo creando/actualizando admin"; exit 1 }
Write-Ok "Admin listo: $AdminEmail"

# 5) Levantar backend (puerto 5051) en nueva ventana
Write-Info "Levantando backend (npm run dev)..."
$backendPath = (Get-Location).Path
Start-Process powershell -ArgumentList "-NoExit","-Command","cd `"$backendPath`"; npm run dev"

# 6) Levantar frontend (puerto 4001) en nueva ventana
$frontendPath = Join-Path $backendPath "..\frontend\school-app"
if (Test-Path $frontendPath) {
  Write-Info "Instalando dependencias del frontend..."
  Push-Location $frontendPath
  npm install
  if ($LASTEXITCODE -ne 0) { Write-Err "Fallo npm install en frontend"; Pop-Location; exit 1 }
  if (-not (Test-Path ".env.local")) {
    Write-Warn "No existe .env.local en frontend; creando uno por defecto..."
    @("NEXT_PUBLIC_API_URL=http://localhost:5051/api") | Out-File -Encoding UTF8 .env.local -Force
  }
  Write-Info "Levantando frontend (npm run dev)..."
  Start-Process powershell -ArgumentList "-NoExit","-Command","cd `"$frontendPath`"; npm run dev"
  Pop-Location
} else {
  Write-Warn "No se encontró el frontend en $frontendPath. Omite arranque del frontend."
}

Write-Ok "Entorno local iniciado."
Write-Info "Backend: http://localhost:5051 | Health: http://localhost:5051/health"
Write-Info "Frontend: http://localhost:4001"
