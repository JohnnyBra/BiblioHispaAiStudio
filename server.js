
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración básica
const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Simular __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Límite alto para backups grandes
app.use(express.static(path.join(__dirname, 'dist'))); // Servir el frontend compilado

// --- BASE DE DATOS SIMPLE (Archivo JSON) ---

// Datos iniciales si el archivo no existe
const INITIAL_DATA = {
  users: [
    {
      id: 'super-admin-1',
      firstName: 'Director',
      lastName: 'General',
      username: 'superadmin',
      password: 'admin123',
      className: 'DIRECCIÓN',
      role: 'SUPERADMIN',
      points: 0,
      booksRead: 0
    }
  ],
  books: [],
  transactions: [],
  reviews: [],
  pointHistory: [],
  settings: {
    schoolName: 'BiblioHispa',
    logoUrl: 'https://cdn-icons-png.flaticon.com/512/3413/3413535.png'
  }
};

// Asegurar que existe la carpeta data y el archivo
async function initDB() {
  try {
    await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
    try {
      await fs.access(DB_FILE);
    } catch {
      console.log('Creando nueva base de datos...');
      await fs.writeFile(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2));
    }
  } catch (err) {
    console.error('Error inicializando DB:', err);
  }
}

// Leer DB
async function readDB() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return INITIAL_DATA;
  }
}

// Guardar DB (Parcial o Total)
async function saveDB(data, key = null) {
  const currentData = await readDB();
  let newData;
  
  if (key) {
    // Actualizar solo una parte (ej: solo users)
    newData = { ...currentData, [key]: data };
  } else {
    // Actualizar todo (restore backup)
    newData = { ...currentData, ...data };
  }

  await fs.writeFile(DB_FILE, JSON.stringify(newData, null, 2));
  return newData;
}

// --- API ENDPOINTS ---

// Obtener todos los datos al iniciar
app.get('/api/db', async (req, res) => {
  const data = await readDB();
  res.json(data);
});

// Restaurar backup completo
app.post('/api/restore', async (req, res) => {
  await saveDB(req.body);
  res.json({ success: true, message: 'Base de datos restaurada' });
});

// Endpoints granulares para guardar cambios
app.post('/api/users', async (req, res) => {
  await saveDB(req.body, 'users');
  res.json({ success: true });
});

app.post('/api/books', async (req, res) => {
  await saveDB(req.body, 'books');
  res.json({ success: true });
});

app.post('/api/transactions', async (req, res) => {
  await saveDB(req.body, 'transactions');
  res.json({ success: true });
});

app.post('/api/reviews', async (req, res) => {
  await saveDB(req.body, 'reviews');
  res.json({ success: true });
});

app.post('/api/pointHistory', async (req, res) => {
  await saveDB(req.body, 'pointHistory');
  res.json({ success: true });
});

app.post('/api/settings', async (req, res) => {
  await saveDB(req.body, 'settings');
  res.json({ success: true });
});

// Cualquier otra ruta devuelve el index.html (para React Router si lo usáramos, o refresh)
app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- SISTEMA DE COPIAS DE SEGURIDAD ---
async function performBackup() {
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  try {
    await fs.mkdir(backupDir, { recursive: true });

    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `db-backup-${timestamp}.json`);

    // Leer y copiar
    const data = await fs.readFile(DB_FILE, 'utf-8');
    await fs.writeFile(backupFile, data);

    console.log(`[BACKUP] Copia de seguridad creada: ${backupFile}`);

    // Limpieza: Mantener solo los últimos 30 backups
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(f => f.startsWith('db-backup-')).sort();

    if (backupFiles.length > 30) {
      const toDelete = backupFiles.slice(0, backupFiles.length - 30);
      for (const file of toDelete) {
        await fs.unlink(path.join(backupDir, file));
        console.log(`[BACKUP] Eliminado backup antiguo: ${file}`);
      }
    }

  } catch (err) {
    console.error('[BACKUP] Error creando copia de seguridad:', err);
  }
}

// Programar backup cada 24 horas (86400000 ms)
setInterval(performBackup, 86400000);

// Iniciar servidor
initDB().then(() => {
  // Ejecutar backup inicial al arrancar (opcional, pero útil para probar)
  performBackup();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor BiblioHispa corriendo en http://localhost:${PORT}`);
    console.log(`📁 Base de datos en: ${DB_FILE}`);
  });
});
