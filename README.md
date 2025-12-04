# 📚 BiblioHispa - Guía de Despliegue con GitHub

Esta guía te explica cómo llevar esta aplicación desde tu ordenador hasta un servidor Ubuntu usando GitHub. Es el método profesional y más sencillo para gestionar actualizaciones.

---

## 🔑 PASO 0: Conseguir la API Key de Google Gemini (Gratis)

Necesitas esto para que la IA funcione.

1.  Entra en **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2.  Inicia sesión y pulsa **"Create API key"**.
3.  Copia el código que empieza por `AIza...`. Lo usaremos más adelante.

---

## 💻 PARTE 1: Preparar el código en tu ordenador (Local)

Antes de ir al servidor, necesitas tener este código en un repositorio de GitHub.

1.  **Crea una carpeta** en tu ordenador llamada `bibliohispa`.
2.  **Copia todos los archivos** que te ha generado la IA dentro de esa carpeta, manteniendo la estructura (`src/`, `components/`, etc.).
3.  Abre una terminal en esa carpeta y ejecuta:
    ```bash
    git init
    git add .
    git commit -m "Primera versión BiblioHispa"
    ```
4.  Ve a **[GitHub.com](https://github.com)**, crea un **Nuevo Repositorio** (ponle nombre `bibliohispa`, déjalo Público o Privado).
5.  GitHub te dará unos comandos para "empujar" tu código. Copia y ejecuta los que se parecen a esto:
    ```bash
    git branch -M main
    git remote add origin https://github.com/TU_USUARIO/bibliohispa.git
    git push -u origin main
    ```
    *(Sustituye `TU_USUARIO` por tu usuario real).*

---

## 🚀 PARTE 2: Despliegue en Servidor Ubuntu

Ahora que el código está en internet (GitHub), vamos a bajarlo al servidor escolar.

### 1. Conectar y Preparar el Servidor
Accede a tu terminal de Ubuntu y ejecuta:

```bash
# 1. Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Git, Curl y Nginx (servidor web)
sudo apt install curl git nginx unzip -y

# 3. Instalar Node.js (versión 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Comprobar que todo está bien
node -v  # Debería decir v20.x.x
npm -v   # Debería decir 10.x.x
```

### 2. Clonar el Repositorio
Vamos a descargar tu código desde GitHub.

```bash
# Ir a la carpeta web
cd /var/www

# Clonar tu repositorio (¡CAMBIA LA URL POR LA TUYA!)
# Si es privado, te pedirá usuario y token (o contraseña)
sudo git clone https://github.com/TU_USUARIO/bibliohispa.git

# Entrar en la carpeta y dar permisos a tu usuario actual (para no usar sudo todo el rato)
sudo chown -R $USER:$USER /var/www/bibliohispa
cd bibliohispa
```

### 3. Instalar Dependencias
Instalamos las librerías necesarias para que la web funcione (React, Vite, QR, Gemini, etc.).

```bash
npm install
```

### 4. Configurar la API Key
Creamos el archivo de configuración secreto.

1.  Crea el archivo `.env`:
    ```bash
    nano .env
    ```
2.  Pega esto dentro (sustituyendo por tu clave del Paso 0):
    ```env
    VITE_API_KEY=AIzaSy...TU_CLAVE_AQUI...
    ```
3.  Guarda con `Ctrl+O`, `Enter` y sal con `Ctrl+X`.

### 5. Construir la Aplicación (Build)
Esto convierte el código en una versión ligera y rápida para producción.

```bash
npm run build
```
*Si todo va bien, verás que se crea una carpeta `dist`.*

### 6. Configurar Nginx (Servidor Web)
Para que la web sea visible en internet o en la red local.

1.  Crear configuración:
    ```bash
    sudo nano /etc/nginx/sites-available/bibliohispa
    ```
2.  Pega esto dentro:
    ```nginx
    server {
        listen 80;
        server_name _; # O tu dominio si tienes (ej: biblio.micolegio.com)

        # Ruta a la carpeta 'dist' que acabamos de crear
        root /var/www/bibliohispa/dist;
        index index.html;

        # Importante para que React funcione al recargar página
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    ```
3.  Activar el sitio y reiniciar:
    ```bash
    sudo ln -s /etc/nginx/sites-available/bibliohispa /etc/nginx/sites-enabled/
    sudo rm /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

### ✅ ¡Listo!
Abre el navegador y pon la **IP de tu servidor**. ¡Tu BiblioHispa debería estar funcionando!

---

## 🔄 PARTE 3: Cómo actualizar la web (Día a día)

Cuando hagas mejoras en el código y las subas a GitHub, sigue estos pasos en tu servidor para aplicarlas:

### 1. Método Manual (Paso a paso)
```bash
cd /var/www/bibliohispa

# Descarga los cambios nuevos
git pull origin main  

# Instala librerías nuevas (si las hubiera)
npm install         

# Reconstruye la web (CRÍTICO: Si no haces esto, no verás los cambios)
npm run build       
```

### 2. Solución de Problemas Comunes

**Problema:** "error: Your local changes to the following files would be overwritten by merge..."
**Causa:** Has editado archivos directamente en el servidor y GitHub no quiere borrarlos.
**Solución:** Descarta los cambios del servidor y fuerza la actualización.
```bash
git reset --hard HEAD
git pull origin main
npm run build
```

**Problema:** "Permission denied"
**Causa:** Permisos de carpeta incorrectos.
**Solución:**
```bash
sudo chown -R $USER:$USER /var/www/bibliohispa
```
