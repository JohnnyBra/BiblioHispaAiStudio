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
# IMPORTANTE: Asegúrate de que la carpeta de destino sea BiblioHispaAiStudio para coincidir con la config
sudo git clone https://github.com/TU_USUARIO/bibliohispa.git BiblioHispaAiStudio

# Entrar en la carpeta y dar permisos a tu usuario actual (para no usar sudo todo el rato)
sudo chown -R $USER:$USER /var/www/BiblioHispaAiStudio
cd /var/www/BiblioHispaAiStudio
```

### 3. Instalar Dependencias
Instalamos las librerías necesarias para que la web funcione (React, Vite, QR, Gemini, etc.).

```bash
npm install
npm install lucide-react react-qr-code html5-qrcode
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
        root /var/www/BiblioHispaAiStudio/dist;
        index index.html;

        # Importante para React funcione al recargar página
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

---

## 🔒 PASO EXTRA: Activar HTTPS (Para que funcione la cámara en Red Local)

Los móviles bloquean la cámara si la web no es segura (HTTPS). Sigue estos pasos para crear un "certificado casero" (autofirmado) que te permitirá usar la cámara si accedes por IP dentro del colegio.

**1. Crear carpeta para certificados:**
```bash
sudo mkdir -p /etc/nginx/ssl
```

**2. Generar las claves (Copia y pega este comando entero):**
Te pedirá datos (país, etc), puedes pulsar ENTER a todo.
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/ssl/selfsigned.key -out /etc/nginx/ssl/selfsigned.crt
```

**3. Configurar Nginx para SSL:**
Edita el archivo de configuración:
```bash
sudo nano /etc/nginx/sites-available/bibliohispa
```
Y sustituye su contenido por este:
```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;

    root /var/www/BiblioHispaAiStudio/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**4. Reiniciar el servidor:**
```bash
sudo systemctl restart nginx
```

---

## 🌍 PARTE 3: Acceso desde Internet (Fuera del Colegio)

Para que los alumnos puedan entrar desde casa sin estar conectados al wifi del colegio, tienes 3 opciones.

### Opción 1: Cloudflare Tunnel (Recomendada 🏆)
Esta opción es la más segura y profesional. Te da HTTPS automático (candadito verde real) y no necesitas tocar el router del colegio.

**Requisitos:** Un dominio propio (ej: `tubiblioteca.com`). Cuestan unos 10€/año en Namecheap o Google Domains.

1.  Crea una cuenta gratuita en **[Cloudflare](https://www.cloudflare.com/)** y añade tu dominio.
2.  En el panel de Cloudflare, ve a **Zero Trust** > **Networks** > **Tunnels**.
3.  Dale a **Create a Tunnel**, elige **Cloudflared** y ponle nombre (ej: "servidor-cole").
4.  Copia el comando de instalación para **Debian/Ubuntu** que te aparece y pégalo en la terminal de tu servidor.
5.  **Configurar el dominio:**
    *   Si acabas de instalarlo, dale a "Next".
    *   Si te has salido, ve a **Networks > Tunnels**, haz clic en tu túnel y entra en la pestaña **Public Hostname**.
6.  Dale a **Add a public hostname** y rellena así:
    *   **Subdomain:** Escribe lo que quieras (ej: `biblioteca`).
    *   **Domain:** Selecciona tu dominio de la lista.
    *   **Path:** Vacío.
    *   **Service Type:** `HTTP`.
    *   **URL:** `localhost:80`.
7.  Dale a **Save**. ¡Listo! Accede por `https://biblioteca.tudominio.com`.

### Opción 2: Ngrok (Gratis y Rápido)
Ideal para pruebas rápidas. No necesitas dominio, pero la URL cambia si reinicias el servidor.

1.  Instala Ngrok en el servidor:
    ```bash
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok
    ```
2.  Regístrate en **[ngrok.com](https://ngrok.com)** y consigue tu `AUTH_TOKEN`.
3.  Conecta tu cuenta: `ngrok config add-authtoken TU_TOKEN`
4.  Inicia el túnel:
    ```bash
    ngrok http 80
    ```
5.  Copia la URL que te da (ej: `https://...ngrok-free.app`).

### Opción 3: Abrir Puertos (Método Clásico)
Solo si tienes acceso al Router del colegio.

1.  Entra al Router (normalmente 192.168.1.1).
2.  Busca **Port Forwarding**.
3.  Abre el puerto **443** (HTTPS) hacia la **IP LOCAL** de tu servidor Ubuntu.
4.  Usa tu **IP PÚBLICA** para acceder.

---

## 🆘 Solución de Problemas

### Error: `ERR_TOO_MANY_REDIRECTS` (La página no carga)
Si ves este error, es porque **Cloudflare** y **Nginx** se están peleando por ver quién pone la seguridad (HTTPS).

**Solución rápida:**
1. Ve a tu panel de **Cloudflare**.
2. Entra en **SSL/TLS** (menú izquierda).
3. Cambia la configuración de **Flexible** a **Full** (o **Full (Strict)**).
4. Espera 1 minuto y recarga la web.

*¿Por qué pasa esto?* Cloudflare estaba intentando entrar a tu servidor como "Inseguro" (HTTP), pero tu servidor (Nginx) le obligaba a ir a "Seguro" (HTTPS), creando un bucle infinito.

---

## 🔄 Rutina de Actualización

Cuando hagas cambios en el código y los subas a GitHub, ejecuta esto en el servidor para actualizar:

```bash
cd /var/www/BiblioHispaAiStudio

# 1. Si tienes cambios locales que estorban, bórralos (CUIDADO)
git reset --hard HEAD

# 2. Descargar lo nuevo
git pull origin main

# 3. Re-instalar y Re-construir
npm install
npm run build
```