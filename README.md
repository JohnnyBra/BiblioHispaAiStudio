# 📚 BiblioHispa - Guía Completa de Instalación y Despliegue

Esta guía cubre dos partes fundamentales:
1.  **Cómo conseguir la "llave" (API Key)** para que la Inteligencia Artificial funcione.
2.  **Cómo instalar la web en un servidor Linux (Ubuntu)** desde cero para que sea accesible en el colegio.

---

## 🔑 PASO 0: Conseguir la API Key de Google Gemini (Gratis)

Para que el "Bibliotecario IA" funcione, necesitas una clave gratuita de Google.

1.  Entra en esta web oficial de Google: **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2.  Inicia sesión con tu cuenta de Google (gmail).
3.  Haz clic en el botón azul grande que dice **"Create API key"**.
4.  Si te pregunta, selecciona "Create API key in new project" (Crear en un proyecto nuevo).
5.  Se generará un código largo y raro que empieza por `AIza...`. **Cópialo y guárdalo en un bloc de notas**, lo necesitaremos en el Paso 5.

---

## 🚀 Guía de Despliegue en Servidor Ubuntu

Sigue estos pasos si tienes un servidor VPS o un ordenador con Ubuntu Server y quieres poner la web online.

### 📋 Requisitos
*   Servidor con Ubuntu 20.04 o superior.
*   Acceso a la terminal (consola negra).

### 1️⃣ Preparar el Servidor
Actualizamos el sistema e instalamos herramientas básicas. Copia y pega estos comandos:

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install curl git unzip -y
```

### 2️⃣ Instalar Node.js
Es el "motor" que hace funcionar la aplicación.

```bash
# Descargar el instalador de la versión 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalarlo
sudo apt-get install -y nodejs

# Comprobar que funciona (debería salir v20.x.x)
node -v
```

### 3️⃣ Crear el Proyecto con Vite
Vamos a crear la estructura de la carpeta de forma moderna.

1.  Vamos a la carpeta web:
    ```bash
    cd /var/www
    ```
    *(Si da error de permisos, usa `cd ~` para hacerlo en tu carpeta personal).*

2.  Creamos el proyecto "bibliohispa":
    ```bash
    npm create vite@latest bibliohispa -- --template react-ts
    ```
    *(Pulsa Enter para aceptar las opciones por defecto si te pregunta).*

3.  Entramos en la carpeta:
    ```bash
    cd bibliohispa
    ```

4.  Instalamos las librerías necesarias:
    ```bash
    npm install
    # IMPORTANTE: Instalamos las dependencias específicas de tu app (IA, QR, Iconos)
    npm install @google/genai lucide-react react-qr-code html5-qrcode
    ```

### 4️⃣ Copiar los Archivos
Ahora hay que meter tu código en el servidor.
*Vite crea una carpeta `src` con archivos de ejemplo. Vamos a borrarlos y poner los tuyos.*

1.  **Limpiar:**
    ```bash
    rm -rf src/*
    mkdir -p src/components
    mkdir -p src/services
    ```

2.  **Crear los archivos:**
    Usa el editor `nano` para crear cada archivo copiando el contenido que tienes.
    *Para guardar en nano: `Ctrl+O`, `Enter`. Para salir: `Ctrl+X`.*

    *   **Edita el `index.html` (en la raíz):**
        ```bash
        nano index.html
        ```
        *(Pega tu código de `index.html` corregido).*

    *   **Crea `src/main.tsx` (Tu antiguo index.tsx):**
        ```bash
        nano src/main.tsx
        ```
        *(Pega aquí el contenido de `index.tsx`).*

    *   **Crea `src/App.tsx`:**
        ```bash
        nano src/App.tsx
        ```
        *(Pega el contenido de `App.tsx`).*

    *   **Crea `src/types.ts`:**
        ```bash
        nano src/types.ts
        ```
        *(Pega el contenido de `types.ts`).*

    *   **Crea los Servicios:**
        ```bash
        nano src/services/storageService.ts
        # (Pega el contenido...)
        
        nano src/services/bookService.ts
        # (Pega el contenido...)

        nano src/services/geminiService.ts
        # (Pega el contenido...)
        ```

    *   **Crea los Componentes:**
        ```bash
        nano src/components/Button.tsx
        nano src/components/BookCard.tsx
        nano src/components/AdminView.tsx
        nano src/components/StudentView.tsx
        nano src/components/QRScanner.tsx
        nano src/components/IDCard.tsx
        nano src/components/Toast.tsx
        # (Pega el contenido correspondiente en cada uno)
        ```

### 5️⃣ Configurar la Clave Secreta (API Key)
Aquí es donde usamos la clave que conseguiste en el **Paso 0**.
**IMPORTANTE:** En Vite, las variables deben empezar por `VITE_`.

1.  Crea un archivo `.env` en la carpeta `bibliohispa` (en la raíz del proyecto):
    ```bash
    nano .env
    ```

2.  Escribe esto dentro (pegando tu clave real después del igual, sin espacios):
    ```env
    VITE_API_KEY=AIzaSy...TU_CLAVE_COPIADA_AQUI...
    ```

### 6️⃣ Construir la Web (Build)
Esto comprime tu código para que ocupe poco y funcione rápido en producción.

```bash
npm run build
```
Si todo va bien, verás una carpeta `dist` creada. Esa es tu web terminada.

### 7️⃣ Ponerla Online con Nginx
Usaremos Nginx para servir esa carpeta `dist`.

1.  Instalar Nginx:
    ```bash
    sudo apt install nginx -y
    ```

2.  Configurar la web:
    ```bash
    sudo nano /etc/nginx/sites-available/bibliohispa
    ```

3.  Pega esto dentro:
    ```nginx
    server {
        listen 80;
        server_name _; # O tu dominio si tienes uno (ej: biblioteca.micolegio.com)

        # Ruta a la carpeta 'dist' que se creó en el paso 6
        # Si instalaste en /var/www:
        root /var/www/bibliohispa/dist; 
        
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    ```

4.  Activar el sitio:
    ```bash
    sudo ln -s /etc/nginx/sites-available/bibliohispa /etc/nginx/sites-enabled/
    sudo rm /etc/nginx/sites-enabled/default  # Borrar el default para evitar conflictos
    ```

5.  Dar permisos de lectura (Importante si sale Error 403):
    ```bash
    # Asegura que Nginx pueda leer los archivos
    sudo chmod -R 755 /var/www/bibliohispa
    ```

6.  Reiniciar Nginx:
    ```bash
    sudo systemctl restart nginx
    ```

### 🎉 ¡Terminado!
Abre el navegador y pon la **IP de tu servidor**. Deberías ver BiblioHispa funcionando con el logo, la IA y todo listo.