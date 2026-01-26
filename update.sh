#!/bin/bash
set -e

echo "=========================================="
echo "    ACTUALIZADOR DE BIBLIOHISPA APP"
echo "=========================================="

# Ensure we are in the project directory
if [ ! -f "package.json" ]; then
    echo "Error: No se encuentra package.json. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

echo "--- 1. Descargando cambios desde GitHub ---"
git pull

echo "--- 2. Instalando dependencias ---"
npm install

echo "--- 3. Construyendo la aplicación ---"
npm run build

echo "--- 4. Reiniciando servidor ---"
if command -v pm2 &> /dev/null; then
    pm2 restart biblioteca || pm2 start server.js --name "biblioteca"
    pm2 save
    echo "Servidor reiniciado con PM2."
else
    echo "AVISO: PM2 no encontrado. Por favor reinicia tu servidor manualmente."
fi

echo "=========================================="
echo "    ACTUALIZACIÓN COMPLETADA"
echo "=========================================="
