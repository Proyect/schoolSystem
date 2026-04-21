#!/bin/bash
# Script para levantar el Sistema Escolar (Backend + Frontend)
# Uso: ./start.sh   o   bash start.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  Levantando Sistema Escolar"
echo "  Backend:  http://localhost:5051"
echo "  Frontend: http://localhost:4001"
echo ""

if [ ! -f "$ROOT/backend/package.json" ]; then
  echo "[ERROR] No se encuentra backend. Ejecuta desde la raíz del proyecto."
  exit 1
fi
if [ ! -f "$ROOT/frontend/school-app/package.json" ]; then
  echo "[ERROR] No se encuentra frontend/school-app."
  exit 1
fi

# Si existe concurrently en la raíz, usar npm run dev
if [ -d "$ROOT/node_modules/concurrently" ]; then
  echo "Ejecutando backend y frontend (npm run dev)..."
  cd "$ROOT" && npm run dev
  exit 0
fi

# Si no: backend en background, frontend en foreground
echo "Iniciando Backend en segundo plano..."
cd "$ROOT/backend" && npm run dev &
BACKEND_PID=$!

sleep 4

echo "Iniciando Frontend..."
cd "$ROOT/frontend/school-app" && npm run dev

# Al salir (Ctrl+C), matar el backend
kill $BACKEND_PID 2>/dev/null || true
