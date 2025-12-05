# 📚 BiblioHispa - Guía de Despliegue (Versión Full Stack)

Esta guía te explica cómo instalar la aplicación en tu servidor. 
**NOVEDAD:** Ahora la aplicación cuenta con una base de datos real alojada en tu servidor (`data/db.json`), por lo que los datos no se pierden y se sincronizan entre todos los dispositivos (tablets, ordenadores del profesor, móviles).

---

## 🔑 PASO 0: Conseguir la API Key de Google Gemini (Gratis)

Necesitas esto para que la IA (recomendaciones, chat) funcione.

1.  Entra en **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2.  Inicia sesión y pulsa **"Create API key"**.
3.  Copia el código que empieza por `AIza...`. Lo usaremos más adelante.

---

## 💻 PARTE 1: Preparar el código en tu ordenador (Local)

1.  **Crea una carpeta** en tu ordenador llamada `bibliohispa`.
2.  **Copia todos los archivos** del proyecto dentro.
3.  Abre una terminal en esa carpeta y sube el código a GitHub:
    ```bash
    git init
    git add .
    git commit -m "Versión con Base de Datos"
    # Crea el repo en GitHub.com y luego:
    git branch -M main
    git remote add origin https://github.com/TU_USUARIO/bibliohispa.git
    git push -u origin main
    ```

---

## 🚀 PARTE 2: Despliegue en Servidor Ubuntu

Como ahora tenemos un "backend" (servidor de datos), la instalación cambia ligeramente respecto a una web estática simple.

### 1. Conectar y Preparar el Servidor
En tu servidor Ubuntu:

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y
sudo apt install curl git nginx unzip -y

# Instalar Node.js (Versión 20 recomendada)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 (Gestor de procesos para mantener la app siempre encendida)
sudo npm install -g pm2
```

### 2. Descargar e Instalar
```bash
cd /var/www
# Clona tu repo (cambia TU_USUARIO)
sudo git clone https://github.com/TU_USUARIO/bibliohispa.git BiblioHispaApp

# Entrar en la carpeta
cd /var/www/BiblioHispaApp

# Dar permisos a tu usuario
sudo chown -R $USER:$USER .

# Instalar TODAS las dependencias (Frontend y Backend)
npm install

# Crear archivo de configuración
nano .env
# DENTRO PEGA: VITE_API_KEY=AIzaSy... (Tu clave del Paso 0)
# Guarda con Ctrl+O, Enter, Ctrl+X

# Construir la parte visual (Frontend)
npm run build
```

### 3. Iniciar el Servidor de Datos (Backend)
Ahora no basta con servir los archivos, hay que arrancar el cerebro de la aplicación (`server.js`). Usaremos PM2 para que se reinicie solo si el servidor se apaga.

```bash
# Iniciar el servidor en el puerto 3000
pm2 start server.js --name "biblioteca"

# Guardar la lista de procesos para que arranque al inicio de Windows/Linux
pm2 save
pm2 startup
# (Ejecuta el comando que te diga 'pm2 startup' si te lo pide)
```

### 4. Configurar Nginx (Reverse Proxy)
Ahora Nginx actuará de "portero": recibirá las peticiones del puerto 80 (internet) y se las pasará a tu aplicación que vive en el puerto 3000.

1.  Edita la configuración:
    ```bash
    sudo nano /etc/nginx/sites-available/bibliohispa
    ```

2.  **Borra todo** y pega esta configuración de Proxy:
    ```nginx
    server {
        listen 80;
        server_name _;
        
        location / {
            # Redirige todo el tráfico a tu aplicación Node.js en el puerto 3000
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

3.  Activa y reinicia:
    ```bash
    sudo ln -s /etc/nginx/sites-available/bibliohispa /etc/nginx/sites-enabled/
    sudo rm /etc/nginx/sites-enabled/default
    sudo systemctl restart nginx
    ```

---

## 🌍 PARTE 3: Acceso Seguro desde Internet (Cloudflare)

Para que funcione la cámara (QR) y sea seguro, usa Cloudflare Tunnel.

1.  Instala el túnel de Cloudflare en tu servidor (si no lo has hecho ya).
2.  En el panel de Cloudflare Zero Trust > Tunnels, configura el "Public Hostname":
    *   **Domain:** `biblioteca.tucolegio.com`
    *   **Service:** `HTTP` -> `localhost:80` (Nginx) O DIRECTAMENTE `localhost:3000` (Node.js). Ambos funcionan.

¡Listo! Ahora todos los datos de libros y alumnos se guardan en el servidor en el archivo `/var/www/BiblioHispaApp/data/db.json`.

---

## 🛠️ Mantenimiento y Copias de Seguridad

**Actualizar la web:**
```bash
cd /var/www/BiblioHispaApp
git pull origin main
npm install
npm run build
pm2 restart biblioteca
```

**Hacer backup manual de la base de datos:**
Simplemente descarga el archivo `/var/www/BiblioHispaApp/data/db.json` o usa el botón "Descargar Backup" desde el panel de administrador en la web.
