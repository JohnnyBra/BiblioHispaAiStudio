
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Ensure node-fetch is installed
import dotenv from 'dotenv'; // Load env vars

dotenv.config();

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
  const payload = req.body;

  // Leemos los datos actuales
  const currentData = await readDB();
  let currentBooks = currentData.books;

  // Protección: Asegurar que currentBooks sea un array
  if (!Array.isArray(currentBooks)) {
      currentBooks = [];
  }

  if (Array.isArray(payload)) {
      // Caso A: El frontend nos envía la lista COMPLETA (desde App.tsx useEffect)
      // Sobrescribimos todo
      await saveDB(payload, 'books');
  } else {
      // Caso B: El frontend nos envía UN SOLO libro (desde addBook)
      // Lo añadimos a la lista existente
      currentBooks.push(payload);
      await saveDB(currentBooks, 'books');
  }

  res.json({ success: true });
});

// Update a book (Used for editing)
app.put('/api/books/:id', async (req, res) => {
    const currentData = await readDB();
    let books = currentData.books;

    // Protección: Si la DB estaba corrupta y books no es array, lo reiniciamos
    if (!Array.isArray(books)) {
        books = [];
    }

    const index = books.findIndex(b => b.id === req.params.id);

    if (index !== -1) {
        books[index] = { ...books[index], ...req.body };
        await saveDB(books, 'books');
        res.json({ success: true, book: books[index] });
    } else {
        res.status(404).json({ error: 'Book not found' });
    }
});

// Delete a book
app.delete('/api/books/:id', async (req, res) => {
    const currentData = await readDB();
    let books = currentData.books;

    // Protección
    if (!Array.isArray(books)) books = [];

    const newBooks = books.filter(b => b.id !== req.params.id);
    await saveDB(newBooks, 'books');
    res.json({ success: true });
});

// Batch import books (enhanced)
app.post('/api/books/batch', async (req, res) => {
  const booksToAdd = req.body;
  const currentData = await readDB();
  const currentBooks = currentData.books || [];

  // Metadata fetching logic for batch items
  for (let book of booksToAdd) {
      if (book.title && (!book.cover || !book.description || !book.genre)) {
          try {
             // Simple search to fill gaps
             const query = `${book.title} ${book.author || ''}`;
             const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${process.env.VITE_API_KEY}`);
             const data = await response.json();
             if (data.items && data.items.length > 0) {
                 const info = data.items[0].volumeInfo;
                 if (!book.cover && info.imageLinks?.thumbnail) book.cover = info.imageLinks.thumbnail.replace('http:', 'https:');
                 if (!book.description && info.description) book.description = info.description;
                 if (!book.genre && info.categories) book.genre = info.categories[0];
                 if (!book.recommendedAge) book.recommendedAge = 'TP';
             }
          } catch (e) { console.error(e); }
      }
      // Assign ID if missing
      if (!book.id) book.id = crypto.randomUUID();
      book.addedDate = new Date().toISOString();
      book.available = true;
  }

  const newBooks = [...currentBooks, ...booksToAdd];
  await saveDB(newBooks, 'books');
  res.json({ success: true, count: booksToAdd.length });
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
