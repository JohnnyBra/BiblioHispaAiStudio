#!/bin/bash

# Load current env if exists (ignoring comments and errors)
if [ -f .env ]; then
    # Simple grep to avoid issues with complex values, mostly to get context if needed.
    # But sourcing might be safer for simple vars.
    # Let's just rely on the user knowing their keys or them being in memory if exported.
    # Actually, let's try to source it.
    set -a
    [ -f .env ] && . ./.env
    set +a
fi

echo "=========================================="
echo "    REPARACIÓN DE CONFIGURACIÓN Y BUILD"
echo "=========================================="
echo "Este script te ayudará a configurar las claves y reconstruir la aplicación."
echo "Si el valor entre corchetes [] es correcto, simplemente pulsa Enter."
echo ""

ask() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"

    # Use existing env var as default if available
    local current_val=${!var_name}
    local final_default=${current_val:-$default}

    read -p "$prompt [$final_default]: " input
    input=${input:-$final_default}

    export $var_name="$input"
}

ask "Google Client ID (Backend)" "" "GOOGLE_CLIENT_ID"
ask "VITE Google Client ID (Frontend)" "$GOOGLE_CLIENT_ID" "VITE_GOOGLE_CLIENT_ID"

# Check specifically for PRISMA_API_SECRET
if [ -z "$PRISMA_API_SECRET" ]; then
    echo ""
    echo "🔴 IMPORTANTE: La clave secreta de API es necesaria para sincronizar con PrismaEdu."
    echo "   Si no la tienes, solicítala al administrador del sistema."
fi
ask "Prisma API Secret" "" "PRISMA_API_SECRET"
if [ -z "$PRISMA_API_SECRET" ]; then
    echo "⚠️  Advertencia: Dejaste la clave secreta vacía. La sincronización podría fallar (error 403)."
fi

ask "Google Gemini API Key" "" "VITE_API_KEY"

echo ""
echo "Guardando configuración en .env..."

# Write to .env
cat > .env <<EOL
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
PRISMA_API_SECRET=$PRISMA_API_SECRET
VITE_API_KEY=$VITE_API_KEY
PORT=3000
EOL

echo "Reconstruyendo Frontend (esto puede tardar unos segundos)..."
npm run build

echo "Reiniciando servidor..."
if command -v pm2 &> /dev/null; then
    pm2 restart biblioteca || pm2 start server.js --name "biblioteca"
else
    echo "PM2 no encontrado. Si no estás usando PM2, recuerda reiniciar tu servidor node manualmente."
fi

echo ""
echo "✅ ¡Listo! Prueba a recargar la página en tu navegador (Ctrl+F5)."
