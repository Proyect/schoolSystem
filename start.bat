@echo off
title Sistema Escolar - Iniciando...
echo.
echo  Levantando Sistema Escolar
echo  Backend:  http://localhost:5051
echo  Frontend: http://localhost:4001
echo.

cd /d "%~dp0"

:: Verificar que existan las carpetas
if not exist "backend\package.json" (
    echo [ERROR] No se encuentra backend. Ejecuta desde la raiz del proyecto.
    pause
    exit /b 1
)
if not exist "frontend\school-app\package.json" (
    echo [ERROR] No se encuentra frontend/school-app. Ejecuta desde la raiz del proyecto.
    pause
    exit /b 1
)

:: Opcion 1: usar npm run dev del root (requiere npm install en raiz)
if exist "node_modules\concurrently" (
    echo Usando npm run dev desde la raiz...
    call npm run dev
    goto :end
)

:: Opcion 2: abrir dos ventanas (backend y frontend)
echo Abriendo Backend en una ventana...
start "Backend - Sistema Escolar" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Abriendo Frontend en otra ventana...
start "Frontend - Sistema Escolar" cmd /k "cd /d %~dp0frontend\school-app && npm run dev"

echo.
echo Backend y Frontend se estan iniciando.
echo Cuando veas "Ready" en ambas ventanas, abre: http://localhost:4001
echo.
pause
:end
