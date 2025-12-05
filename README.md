# 📚 BiblioHispa - Guía de Despliegue con GitHub

Esta guía te explica cómo llevar esta aplicación desde tu ordenador hasta un servidor Ubuntu usando GitHub.

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
2.  **Copia todos los archivos** que te ha generado la IA dentro de esa carpeta.
3.  Abre una terminal en esa carpeta y ejecuta:
    ```bash
    git init
    git add .
    git commit -m "Primera versión BiblioHispa"
    ```
4.  Ve a **[GitHub.com](https://github.com)**, crea un **Nuevo Repositorio** (ponle nombre `bibliohispa`).
5.  Copia y ejecuta los comandos que te da GitHub:
    ```bash
    git branch -M main
    git remote add origin https://github.com/TU_USUARIO/bibliohispa.git
    git push -u origin main
    ```

---

## 🚀 PARTE 2: Despliegue en Servidor Ubuntu

### 1. Conectar y Preparar el Servidor
En tu servidor Ubuntu:

```bash
# Actualizar e instalar herramientas básicas
sudo apt update && sudo apt upgrade -y
sudo apt install curl git nginx unzip -y

# Instalar Node.js (versión 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Descargar el Código
```bash
cd /var/www
# Clona tu repo (cambia TU_USUARIO)
sudo git clone https://github.com/TU_USUARIO/bibliohispa.git BiblioHispaAiStudio

# Dar permisos
sudo chown -R $USER:$USER /var/www/BiblioHispaAiStudio
cd /var/www/BiblioHispaAiStudio
```

### 3. Instalar y Configurar
```bash
# Instalar dependencias
npm install

# Crear archivo de claves
nano .env
# DENTRO PEGA: VITE_API_KEY=AIzaSy... (Tu clave del Paso 0)
# Guarda con Ctrl+O, Enter, Ctrl+X

# Construir la web
npm run build
```

### 4. Configurar Nginx (Modo Simple)
Esta configuración evita errores con Cloudflare. Nginx solo servirá los archivos en el puerto 80.

1.  Edita la configuración:
    ```bash
    sudo nano /etc/nginx/sites-available/bibliohispa
    ```

2.  **Borra todo** y pega solo esto:
    ```nginx
    server {
        listen 80;
        server_name _;
        
        # Ruta donde está tu web construida
        root /var/www/BiblioHispaAiStudio/dist;
        index index.html;

        # Esto permite que React maneje las rutas
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    ```

3.  Activa la web:
    ```bash
    sudo ln -s /etc/nginx/sites-available/bibliohispa /etc/nginx/sites-enabled/
    sudo rm /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

---

## 🌍 PARTE 3: Conectar con Cloudflare (Internet)

Para que funcione la cámara y acceder desde casa de forma segura.

1.  En tu panel de **Cloudflare Zero Trust** > **Networks** > **Tunnels**.
2.  Instala el túnel en tu servidor (copiando el comando que te dan).
3.  Ve a la pestaña **Public Hostname** de tu túnel.
4.  Añade un hostname:
    *   **Subdomain:** `biblioteca` (o lo que quieras).
    *   **Domain:** `tudominio.com`.
    *   **Service Type:** `HTTP` (Importante: HTTP, no HTTPS).
    *   **URL:** `localhost:80`.
5.  Guarda.

¡Listo! Al entrar en `https://biblioteca.tudominio.com`, Cloudflare pone el candado de seguridad (HTTPS) y tu servidor Nginx le entrega los archivos por detrás sin conflictos.

**Nota sobre la cámara:**
La cámara funcionará perfectamente entrando por el dominio de Cloudflare (porque tiene HTTPS). Si entras por la IP local (`http://192.168.x.x`), la cámara NO funcionará porque los navegadores exigen HTTPS. Usa siempre el dominio.

---

## 🔄 Cómo actualizar en el futuro

```bash
cd /var/www/BiblioHispaAiStudio
git pull origin main
npm install
npm run build
```