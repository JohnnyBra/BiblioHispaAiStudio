# 📚 BiblioHispa - Guía de Despliegue

Esta guía explica cómo instalar y desplegar la aplicación directamente desde GitHub en tu servidor Ubuntu.
La aplicación incluye un backend (Node.js/Express) y una base de datos local (`data/db.json`), por lo que los datos se guardan en tu servidor y se sincronizan entre dispositivos.

---

## 🔑 PASO 0: Conseguir la API Key de Google Gemini (Gratis)

Necesaria para las funciones de IA (recomendaciones, chat).

1.  Entra en **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2.  Inicia sesión y pulsa **"Create API key"**.
3.  Copia el código que empieza por `AIza...`. Lo usaremos más adelante.

---

## 🚀 PASO 1: Preparar el Servidor (Ubuntu)

Conéctate a tu servidor y ejecuta los siguientes comandos para instalar las herramientas necesarias:

```bash
# 1. Actualizar sistema
sudo apt update && sudo apt upgrade -y
sudo apt install curl git nginx unzip -y

# 2. Instalar Node.js (Versión 20 LTS recomendada)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instalar PM2 (Gestor de procesos para mantener la app siempre encendida)
sudo npm install -g pm2
```

---

## 📥 PASO 2: Descargar e Instalar la Aplicación

```bash
# 1. Ir a la carpeta web
cd /var/www

# 2. Clonar el repositorio (Usa la URL de TU repositorio o este mismo)
# Si es este mismo repo:
sudo git clone https://github.com/TU_USUARIO/bibliohispa.git BiblioHispaApp
# (Si usas un repositorio privado, te pedirá usuario y token/contraseña)

# 3. Entrar en la carpeta
cd /var/www/BiblioHispaApp

# 4. Asignar permisos a tu usuario actual (para no usar sudo en todo)
sudo chown -R $USER:$USER .

# 5. Instalar dependencias
npm install

# 6. Configurar variables de entorno
nano .env
```

**Dentro del editor nano, pega lo siguiente (usando tu clave del Paso 0):**
```env
VITE_API_KEY=AIzaSyTuClaveDeGoogleGeminiAqui
```
*(Guarda con `Ctrl+O`, `Enter`, y sal con `Ctrl+X`)*

```bash
# 7. Construir la aplicación (Frontend)
npm run build
```

---

## 🟢 PASO 3: Iniciar el Servidor

Usaremos PM2 para gestionar el proceso de Node.js.

```bash
# 1. Iniciar el servidor backend
pm2 start server.js --name "biblioteca"

# 2. Configurar PM2 para que arranque automáticamente al reiniciar el servidor
pm2 save
pm2 startup
# (Copia y pega el comando que te muestre 'pm2 startup' si te lo pide)
```

**Verificación:**
Puedes probar si funciona ejecutando: `curl http://localhost:3000`. Debería responderte.

---

## 🌐 PASO 4: Exponer a Internet (Nginx + Cloudflare)

### Opción A: Usar Cloudflare Tunnel (Recomendado/Seguro)
Esta es la opción más fácil para tener HTTPS (candado seguro) y acceso desde fuera sin abrir puertos en el router.

1.  Instala `cloudflared` en tu servidor siguiendo las instrucciones de tu panel Cloudflare Zero Trust.
2.  Crea un Túnel y configura el **Public Hostname**:
    *   **Domain:** `biblioteca.tucolegio.com`
    *   **Service:** `HTTP` -> `localhost:3000`

¡Listo! No necesitas configurar Nginx si usas el Túnel apuntando directamente al puerto 3000.

### Opción B: Usar Nginx como Proxy Inverso (Si no usas Tunnel)
Si prefieres usar Nginx tradicional:

1.  Crea el archivo de configuración:
    ```bash
    sudo nano /etc/nginx/sites-available/bibliohispa
    ```

2.  Pega el siguiente contenido:
    ```nginx
    server {
        listen 80;
        server_name tu-dominio.com; # O pon _ si no tienes dominio aún

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

3.  Activa el sitio y reinicia Nginx:
    ```bash
    sudo ln -s /etc/nginx/sites-available/bibliohispa /etc/nginx/sites-enabled/
    sudo rm /etc/nginx/sites-enabled/default  # (Opcional: borra el default si molesta)
    sudo systemctl restart nginx
    ```

---

## 🛠️ Mantenimiento

**Actualizar la aplicación:**
```bash
cd /var/www/BiblioHispaApp
git pull
npm install
npm run build
pm2 restart biblioteca
```

**Ver logs (si hay errores):**
```bash
pm2 logs biblioteca
```

**Copia de Seguridad de Datos:**
El archivo importante es `/var/www/BiblioHispaApp/data/db.json`. Descárgalo regularmente para tener backup.

**⚠️ IMPORTANTE: SEGURIDAD**
La aplicación viene con un usuario administrador por defecto (`superadmin` / `admin123`).
**Cambia esta contraseña inmediatamente** después de instalar. Puedes hacerlo desde el panel de administración de la web o editando el archivo `data/db.json` (si detienes el servidor antes).
