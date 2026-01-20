#!/bin/bash

# ==========================================
# BiblioHispa - Script de Instalación Automatizada
# ==========================================

echo "=========================================="
echo "    INSTALADOR DE BIBLIOHISPA APP"
echo "=========================================="
echo ""

# Función para pedir input
ask() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"

    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        input=${input:-$default}
    else
        read -p "$prompt: " input
    fi

    export $var_name="$input"
}

# --- 1. RECOGIDA DE DATOS ---

echo "--- CONFIGURACIÓN INICIAL ---"

# Directorio base de instalación (por defecto /var/www)
ask "Directorio base de instalación" "/var/www" "BASE_DIR"

# Nombre de la carpeta del proyecto
ask "Nombre de la carpeta del proyecto" "BiblioHispaApp" "PROJECT_DIR"

# URL del repositorio Git
# Intentar detectar URL del repositorio actual
CURRENT_REMOTE=$(git config --get remote.origin.url 2>/dev/null)
DEFAULT_REPO=${CURRENT_REMOTE:-"https://github.com/TU_USUARIO/bibliohispa.git"}

ask "URL del repositorio Git" "$DEFAULT_REPO" "REPO_URL"

# API Key de Google Gemini (Opcional en este momento, pero recomendada)
echo ""
echo "Necesitas una API Key de Google Gemini para las funciones de IA."
echo "Si no la tienes, puedes dejarlo en blanco y editar el archivo .env más tarde."
ask "API Key de Google Gemini" "" "GEMINI_KEY"

FULL_PATH="$BASE_DIR/$PROJECT_DIR"

echo ""
echo "--- RESUMEN ---"
echo "Instalar en: $FULL_PATH"
echo "Repositorio: $REPO_URL"
echo "API Key:     ${GEMINI_KEY:-(No especificada)}"
echo ""
read -p "¿Es correcto? (s/n): " confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo "Cancelando instalación."
    exit 1
fi

# --- 2. PREPARACIÓN DEL SISTEMA ---

echo ""
echo "--- PASO 1: PREPARAR SISTEMA ---"
echo "Actualizando paquetes e instalando dependencias (esto puede tardar)..."
sudo apt update && sudo apt upgrade -y
sudo apt install curl git nginx unzip -y

# Instalar Node.js 20 si no está
if ! command -v node &> /dev/null; then
    echo "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js ya está instalado."
fi

# Instalar PM2 globalmente
if ! command -v pm2 &> /dev/null; then
    echo "Instalando PM2..."
    sudo npm install -g pm2
else
    echo "PM2 ya está instalado."
fi

# --- 3. DESCARGA E INSTALACIÓN ---

echo ""
echo "--- PASO 2: DESCARGAR E INSTALAR ---"

# Crear directorio si no existe
if [ ! -d "$BASE_DIR" ]; then
    echo "Creando directorio base $BASE_DIR..."
    sudo mkdir -p "$BASE_DIR"
fi

# Ir al directorio
cd "$BASE_DIR" || exit

# Clonar repositorio
if [ -d "$PROJECT_DIR" ]; then
    echo "La carpeta $PROJECT_DIR ya existe. ¿Deseas borrarla y re-clonar? (s/n)"
    read -p "> " overwrite
    if [[ "$overwrite" == "s" || "$overwrite" == "S" ]]; then
        sudo rm -rf "$PROJECT_DIR"
        echo "Clonando repositorio..."
        sudo git clone "$REPO_URL" "$PROJECT_DIR"
    else
        echo "Usando carpeta existente. Actualizando..."
        cd "$PROJECT_DIR"
        sudo git pull
        cd ..
    fi
else
    echo "Clonando repositorio..."
    sudo git clone "$REPO_URL" "$PROJECT_DIR"
fi

# Entrar en la carpeta
cd "$PROJECT_DIR" || exit

# Asignar permisos al usuario actual
echo "Asignando permisos..."
sudo chown -R $USER:$USER .

# Instalar dependencias del proyecto
echo "Instalando dependencias NPM..."
npm install

# Configurar .env
echo "Configurando archivo .env..."
if [ -n "$GEMINI_KEY" ]; then
    echo "VITE_API_KEY=$GEMINI_KEY" > .env
    echo ".env creado con la clave proporcionada."
else
    if [ ! -f .env ]; then
        echo "VITE_API_KEY=AIzaSy..." > .env
        echo ".env creado con clave de ejemplo. POR FAVOR EDÍTALO."
    else
        echo ".env ya existe, no se ha modificado."
    fi
fi

# Construir frontend
echo "Construyendo aplicación (Build)..."
npm run build

# --- 4. INICIO DEL SERVIDOR ---

echo ""
echo "--- PASO 3: INICIAR SERVIDOR ---"

# Iniciar con PM2
pm2 start server.js --name "biblioteca"
pm2 save
pm2 startup | tail -n 1 > startup_cmd.sh
# Ejecutar el comando de startup si es necesario (generalmente pm2 startup devuelve un comando para ejecutar con sudo)
# Como esto es un script interactivo, mejor le decimos al usuario que lo haga si falla la persistencia,
# pero 'pm2 save' guarda la lista actual.

echo ""
echo "=========================================="
echo "    INSTALACIÓN COMPLETADA"
echo "=========================================="
echo "La aplicación debería estar corriendo en el puerto 3000."
echo "Prueba: curl http://localhost:3000"
echo ""
echo "Para ver los logs: pm2 logs biblioteca"
echo "Para detener: pm2 stop biblioteca"
echo ""
echo "IMPORTANTE:"
echo "1. Si configuraste una clave API, verifica que funciona."
echo "2. Cambia la contraseña del usuario 'superadmin' lo antes posible."
echo "3. Si necesitas exponerlo a internet, sigue el PASO 4 del README (Cloudflare o Nginx)."

exit 0
