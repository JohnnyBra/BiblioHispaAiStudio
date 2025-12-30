
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

// --- GAMIFICATION CONFIG ---
const BADGES = [
  { id: 'streak-3', name: 'Lector Constante', icon: '🔥', description: 'Racha de 3 días seguidos leyendo', criteria: { streak: 3 } },
  { id: 'streak-7', name: 'Ratón de Biblioteca', icon: '🐁', description: 'Racha de 7 días seguidos leyendo', criteria: { streak: 7 } },
  { id: 'streak-30', name: 'Devorador de Libros', icon: '🦖', description: 'Racha de 30 días seguidos leyendo', criteria: { streak: 30 } },
  { id: 'reviews-1', name: 'Crítico Novato', icon: '📝', description: 'Has escrito tu primera opinión', criteria: { reviews: 1 } },
  { id: 'reviews-5', name: 'Crítico Experto', icon: '✒️', description: 'Has escrito 5 opiniones', criteria: { reviews: 5 } },
  { id: 'books-10', name: 'Pila de Libros', icon: '📚', description: 'Has leído 10 libros', criteria: { books: 10 } },
  { id: 'early-bird', name: 'Madrugador', icon: '🌅', description: 'Devolver un libro antes de tiempo', criteria: { type: 'manual' } }
];

const POINTS = {
  CHECKOUT: 10,
  RETURN: 20,
  RETURN_EARLY: 10, // Bonus
  REVIEW: 15,
  STREAK_BONUS: 5 // Per day of streak
};

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

// Simple Mutex for DB writes to prevent race conditions
let dbLock = Promise.resolve();

function withDbLock(task) {
  const result = dbLock.then(() => task());
  dbLock = result.catch(() => {}); // Prevent queue blockage on error
  return result;
}

// Guardar DB (Parcial o Total)
async function saveDB(data, key = null) {
  return withDbLock(async () => {
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
  });
}

// Helper: Check and Award Badges
async function checkAndAwardBadges(user, context, allData) {
    let newBadges = [];
    const currentBadges = user.badges || [];

    // Check Streak Badges
    if (context.streak) {
        BADGES.filter(b => b.criteria.streak && b.criteria.streak <= user.currentStreak).forEach(b => {
            if (!currentBadges.includes(b.id)) newBadges.push(b.id);
        });
    }

    // Check Reviews Badges
    if (context.reviewCount) {
         BADGES.filter(b => b.criteria.reviews && b.criteria.reviews <= context.reviewCount).forEach(b => {
            if (!currentBadges.includes(b.id)) newBadges.push(b.id);
        });
    }

    // Check Books Read Badges
    if (context.booksRead) {
        BADGES.filter(b => b.criteria.books && b.criteria.books <= context.booksRead).forEach(b => {
             if (!currentBadges.includes(b.id)) newBadges.push(b.id);
        });
    }

    // Manual Badges (Early Bird)
    if (context.earlyReturn) {
         const badgeId = 'early-bird';
         if (!currentBadges.includes(badgeId)) newBadges.push(badgeId);
    }

    return newBadges;
}

// --- PRISMA EDU INTEGRATION HELPER ---
async function fetchFromPrisma(endpoint, method = 'GET', body = null) {
  const baseUrl = process.env.PRISMA_API_URL || 'https://prisma.bibliohispa.es';
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${cleanBaseUrl}${endpoint}`;

  console.log(`Calling Prisma API: ${url}`);

  if (!process.env.PRISMA_API_SECRET) {
      console.warn('Warning: PRISMA_API_SECRET environment variable is not set.');
  }

  const options = {
    method,
    headers: {
      'api_secret': process.env.PRISMA_API_SECRET,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
     const text = await response.text();
     console.error(`Prisma API Error (${response.status}): ${text}`);
     throw new Error(`Prisma API responded with ${response.status}: ${text}`);
  }
  return response.json();
}

// --- API ENDPOINTS ---

// GET BADGES METADATA
app.get('/api/badges', (req, res) => {
    res.json(BADGES);
});

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
  const user = req.body;
  if (Array.isArray(user)) {
      return res.status(400).json({ error: "Para guardar masivamente usa /api/users/batch o restore. No envíes la lista entera." });
  }

  const currentData = await readDB();
  const users = currentData.users || [];
  const index = users.findIndex(u => u.id === user.id);

  if (index >= 0) {
      users[index] = { ...users[index], ...user }; // Actualizar
  } else {
      // Asegurar ID
      if (!user.id) user.id = `user-${Date.now()}`;
      users.push(user); // Crear nuevo
  }

  await saveDB(users, 'users');
  res.json({ success: true });
});

// Update user granularly (Explicit PUT)
app.put('/api/users/:id', async (req, res) => {
  const currentData = await readDB();
  let users = currentData.users || [];

  const index = users.findIndex(u => u.id === req.params.id);
  if (index !== -1) {
      users[index] = { ...users[index], ...req.body };
      await saveDB(users, 'users');
      res.json({ success: true, user: users[index] });
  } else {
      res.status(404).json({ error: 'User not found' });
  }
});

// Delete user granularly
app.delete('/api/users/:id', async (req, res) => {
  const currentData = await readDB();
  let users = currentData.users || [];

  const newUsers = users.filter(u => u.id !== req.params.id);
  await saveDB(newUsers, 'users');
  res.json({ success: true });
});

// Batch import users (append only)
app.post('/api/users/batch', async (req, res) => {
  const usersToAdd = req.body;
  if (!Array.isArray(usersToAdd)) return res.status(400).json({ error: "Body must be an array" });

  const currentData = await readDB();
  const currentUsers = currentData.users || [];

  // Assign IDs if missing
  usersToAdd.forEach(u => {
      if (!u.id) u.id = `user-${Date.now()}-${Math.random().toString(36).substr(2,4)}`;
  });

  const newUsers = [...currentUsers, ...usersToAdd];
  await saveDB(newUsers, 'users');
  res.json({ success: true, count: usersToAdd.length });
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
      // PREVENCIÓN DE SOBRESCRITURA ACCIDENTAL
      return res.status(400).json({ error: 'Para guardar masivamente usa /api/books/batch o restore. No se permite sobrescribir toda la lista.' });
  } else {
      // Caso B: Añadir UN SOLO libro
      // Asigna ID si no tiene
      if (!payload.id) payload.id = crypto.randomUUID ? crypto.randomUUID() : `book-${Date.now()}`;

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
                 if (!book.recommendedAge) book.recommendedAge = '6-8';
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

// --- AUTH & SYNC ENDPOINTS (PHASE 2) ---

// Verify Google Login Email against Prisma Users
app.post('/api/auth/google-verify', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
     // Fetch users from Prisma
     const usersList = await fetchFromPrisma('/api/export/users'); // [{id, name, role, email, classId}, ...]

     const prismaUser = usersList.find(u => u.email === email);

     if (!prismaUser) {
         return res.status(401).json({ error: 'Email no encontrado en el sistema escolar.' });
     }

     const allowedRoles = ['TUTOR', 'ADMIN', 'DIRECCION', 'TESORERIA'];
     if (!allowedRoles.includes(prismaUser.role)) {
         return res.status(403).json({ error: 'Tu rol no tiene acceso a esta aplicación.' });
     }

     // Map to Local User format
     const localUser = mapPrismaUserToLocal(prismaUser);

     // Upsert into local DB
     await upsertUserToDB(localUser);

     res.json({ success: true, user: localUser });

  } catch (error) {
     console.error('Google Auth Error:', error);
     res.status(500).json({ error: 'Error validando con PrismaEdu.' });
  }
});


// Login Profesor (Proxy to External Auth) - MANUAL LOGIN
app.post('/api/auth/teacher-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Petición interna a PrismaEdu (External Service)
    const data = await fetchFromPrisma('/api/auth/external-check', 'POST', { username, password });

    if (data.success) {
      // Map response to local user
      // Assuming data from external-check looks like { success: true, user: { ... } } or similar based on prompt context
      // Prompt says: Response: { success: true, role, ... }

      // We might need to fetch the full user details if 'external-check' returns minimal info.
      // But let's assume it returns enough or we match against the export list.
      // To be safe, let's fetch the user list and find the user by username/id if possible,
      // OR construct based on response.
      // Let's assume the response has { id, name, role, classId } etc.

      // Fallback: If response lacks details, fetch user list?
      // "Devuelve: { success: true, role, ... }" - it implies it returns user info.

      const teacherUser = mapPrismaUserToLocal(data.user || {
          id: `manual-${username}`,
          name: username,
          role: data.role || 'ADMIN',
          classId: data.classId
      });

      // PERSISTENCE: Upsert teacher to local DB so App.tsx can find it on refresh
      await upsertUserToDB(teacherUser);

      res.json({ success: true, user: teacherUser });
    } else {
      res.status(401).json({ error: 'Credenciales inválidas en sistema centralizado.' });
    }
  } catch (error) {
    console.error('Error connecting to auth service:', error);
    res.status(500).json({ error: 'Error de conexión con el sistema de autenticación.' });
  }
});

// Helper to Upsert
async function upsertUserToDB(user) {
    const currentData = await readDB();
    const users = currentData.users || [];
    const index = users.findIndex(u => u.id === user.id);

    if (index !== -1) {
        // Update existing (preserve points/badges)
        users[index] = { ...users[index], ...user, points: users[index].points, badges: users[index].badges };
    } else {
        // Add new
        users.push(user);
    }
    await saveDB(users, 'users');
}

// Helper to Map Prisma User to Local User
function mapPrismaUserToLocal(prismaUser) {
    // Determine Role Mapping
    let role = 'ADMIN'; // Default for teachers
    if (prismaUser.role === 'DIRECCION' || prismaUser.role === 'TESORERIA') role = 'SUPERADMIN';
    if (prismaUser.role === 'TUTOR') role = 'ADMIN';

    return {
         id: prismaUser.id.toString(), // Ensure string
         firstName: prismaUser.name || 'Profesor',
         lastName: prismaUser.surname || '',
         username: prismaUser.email ? prismaUser.email.split('@')[0] : `user${prismaUser.id}`,
         role: role,
         className: prismaUser.classId || 'STAFF', // Store classId in className for mapping? Or add new field?
         // We'll overload className or add a new property if TS allows.
         // TS Definition has className. We can put classId there or look it up.
         // Better: Keep className as the "Display Name" of the class, but we only have ID.
         // We will need to fetch classes to map ID -> Name later.
         // For now, store ID in className or a generic 'PROFESORADO'.
         // Let's store 'classId: X' in className if it's a tutor, so frontend can parse it?
         // Or better, just fetch classes and resolve it.
         classId: prismaUser.classId, // Add this property (ignored by TS if not in interface but stored in JSON)
         points: 0,
         booksRead: 0,
         isExternal: true
    };
}


// Sincronización de Alumnos y Clases
app.post('/api/sync/students', async (req, res) => {
  try {
    // 1. Obtener datos externos
    const externalStudents = await fetchFromPrisma('/api/export/students');
    const externalClasses = await fetchFromPrisma('/api/export/classes');

    // 2. Leer DB Local
    const currentData = await readDB();
    let currentUsers = currentData.users || [];
    let updatedCount = 0;
    let createdCount = 0;

    // 3. Crear mapa de Clases (ID -> Name) para llenar "className" legible
    const classMap = {};
    externalClasses.forEach(c => {
        classMap[c.id] = c.name; // e.g. "1A", "2B"
    });

    // 4. Merge Logic for Students
    for (const extStudent of externalStudents) {
       // Buscar por ID
       let localUserIndex = currentUsers.findIndex(u => u.id === String(extStudent.id));

       const className = classMap[extStudent.classId] || 'Sin Asignar';

       if (localUserIndex !== -1) {
          // UPDATE (Merge)
          const localUser = currentUsers[localUserIndex];
          currentUsers[localUserIndex] = {
             ...localUser,
             firstName: extStudent.name || localUser.firstName,
             lastName: extStudent.surname || localUser.lastName, // If provided
             className: className,
             classId: extStudent.classId, // Store ID for filtering
             role: 'STUDENT'
          };
          updatedCount++;
       } else {
          // CREATE
          const newUser = {
             id: String(extStudent.id),
             firstName: extStudent.name,
             lastName: extStudent.surname || '',
             className: className,
             classId: extStudent.classId,
             username: `${normalizeString(extStudent.name)}`.toLowerCase(), // Simple username
             role: 'STUDENT',
             points: 0,
             booksRead: 0,
             badges: [],
             currentStreak: 0
          };
          currentUsers.push(newUser);
          createdCount++;
       }
    }

    // Also store classes metadata in settings or separate file?
    // The frontend might need the raw class list for filters.
    // Let's store it in a 'classes.json' or inside 'settings' in db.json?
    // Let's put it in settings for now or just trust the student properties.
    // Ideally we expose an endpoint /api/classes that returns the cached classes.
    // For now, we will cache the class list in a separate file or memory?
    // Let's append it to the response so frontend can cache it if needed,
    // but better to save to DB so we don't spam Prisma.
    // currentData.classes = externalClasses; // Add if schema permits.
    // We'll stick to just syncing students for now as per "Sync Students" endpoint name.

    // 4. Save
    await saveDB(currentUsers, 'users');
    res.json({ success: true, updated: updatedCount, created: createdCount, classes: externalClasses });

  } catch (error) {
    console.error('Sync Error:', error);
    res.status(500).json({ error: 'Error durante la sincronización.' });
  }
});

function normalizeString(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '.');
}

// --- GAMIFICATION ACTION ENDPOINTS ---

// Checkout Action
app.post('/api/actions/checkout', async (req, res) => {
    return withDbLock(async () => {
        const { userId, bookId } = req.body;
        const currentData = await readDB();

        // 1. Validate
        const bookIndex = currentData.books.findIndex(b => b.id === bookId);
        const userIndex = currentData.users.findIndex(u => u.id === userId);

        if (bookIndex === -1 || userIndex === -1) return res.status(404).json({error: 'Not found'});
        if (currentData.books[bookIndex].unitsAvailable <= 0) return res.status(400).json({error: 'No stock'});

        const user = currentData.users[userIndex];

        // 2. Logic: Decrease stock
        currentData.books[bookIndex].unitsAvailable -= 1;

        // 3. Logic: Create Transaction
        const transaction = {
            id: `tx-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
            userId,
            bookId,
            dateBorrowed: new Date().toISOString(),
            active: true
        };
        currentData.transactions.push(transaction);

        // 4. Logic: User Points & Streak
        user.points = (user.points || 0) + POINTS.CHECKOUT;

        // Streak Logic
        const today = new Date().toISOString().split('T')[0];
        const lastActivity = user.lastActivityDate ? user.lastActivityDate.split('T')[0] : null;

        if (lastActivity === today) {
            // Already active today, no streak increment but points ok
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastActivity === yesterdayStr) {
                user.currentStreak = (user.currentStreak || 0) + 1;
            } else {
                user.currentStreak = 1; // Reset or Start
            }
        }
        user.lastActivityDate = new Date().toISOString();

        // Check Badges
        const newBadges = await checkAndAwardBadges(user, { streak: true }, currentData);
        if (newBadges.length > 0) {
            user.badges = [...(user.badges || []), ...newBadges];
        }

        // Add history log
        currentData.pointHistory.push({
            id: `ph-${Date.now()}`,
            userId,
            amount: POINTS.CHECKOUT,
            reason: 'Préstamo de libro',
            date: new Date().toISOString()
        });

        // Save
        await fs.writeFile(DB_FILE, JSON.stringify(currentData, null, 2));
        res.json({ success: true, transaction, userPoints: user.points, newBadges });
    });
});

// Return Action
app.post('/api/actions/return', async (req, res) => {
    return withDbLock(async () => {
        const { bookId, userId } = req.body; // Can be triggered by bookId (scanner) or user context
        const currentData = await readDB();

        // Find active transaction
        // If we only have bookId (from scanner), finding the correct transaction might be ambiguous if multiple copies are out?
        // But usually we scan the book QR. The system assumes unique IDs for each book copy?
        // The current system seems to assume one 'book' entry has multiple 'units'.
        // So we need to find ANY active transaction for this bookId.
        // Ideally, we should know the USER who is returning it.
        // If we don't send userId, we pick the oldest active transaction for this book?
        // Let's assume the frontend sends both if possible, or we search.

        // Strategy: Look for transaction matching bookId AND userId (if provided).
        // If only bookId provided (Admin scanner mode might not know user?), we might need to ask "Who is returning?".
        // For now, assume userId is passed or we find the first one.

        let txIndex = -1;
        if (userId) {
            txIndex = currentData.transactions.findIndex(t => t.bookId === bookId && t.userId === userId && t.active);
        } else {
             // Fallback: Find any active transaction for this book (risky if multiple copies out)
             txIndex = currentData.transactions.findIndex(t => t.bookId === bookId && t.active);
        }

        if (txIndex === -1) return res.status(404).json({error: 'Active transaction not found'});

        const tx = currentData.transactions[txIndex];
        const userIndex = currentData.users.findIndex(u => u.id === tx.userId);
        const bookIndex = currentData.books.findIndex(b => b.id === tx.bookId);

        if (userIndex === -1 || bookIndex === -1) return res.status(500).json({error: 'Data integrity error'});

        const user = currentData.users[userIndex];
        const book = currentData.books[bookIndex];

        // 1. Update Transaction
        tx.active = false;
        tx.dateReturned = new Date().toISOString();

        // 2. Update Book
        book.unitsAvailable = Math.min(book.unitsAvailable + 1, book.unitsTotal);
        book.readCount = (book.readCount || 0) + 1;

        // 3. User Points
        let pointsEarned = POINTS.RETURN;
        let earlyReturn = false;

        // Check early return (within 7 days?)
        const borrowedDate = new Date(tx.dateBorrowed);
        const returnedDate = new Date();
        const diffDays = (returnedDate - borrowedDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) {
            pointsEarned += POINTS.RETURN_EARLY;
            earlyReturn = true;
        }

        user.points = (user.points || 0) + pointsEarned;
        user.booksRead = (user.booksRead || 0) + 1;

        // Maintain/Update Streak (Returning also counts as activity)
        user.lastActivityDate = new Date().toISOString();

        // Check Badges
        const newBadges = await checkAndAwardBadges(user, { booksRead: user.booksRead, earlyReturn }, currentData);
        if (newBadges.length > 0) {
            user.badges = [...(user.badges || []), ...newBadges];
        }

        // Add history log
        currentData.pointHistory.push({
             id: `ph-${Date.now()}`,
             userId: user.id,
             amount: pointsEarned,
             reason: earlyReturn ? 'Devolución rápida (+Bonus)' : 'Devolución de libro',
             date: new Date().toISOString()
        });

        await fs.writeFile(DB_FILE, JSON.stringify(currentData, null, 2));
        res.json({ success: true, userPoints: user.points, newBadges });
    });
});

// Review Action
app.post('/api/actions/review', async (req, res) => {
    return withDbLock(async () => {
        const review = req.body; // { bookId, userId, rating, comment, ... }
        const currentData = await readDB();

        // Save Review
        if (!review.id) review.id = `rev-${Date.now()}`;
        currentData.reviews.push(review);

        // Update User Points
        const userIndex = currentData.users.findIndex(u => u.id === review.userId);
        if (userIndex !== -1) {
            const user = currentData.users[userIndex];
            user.points = (user.points || 0) + POINTS.REVIEW;

            // Check Badges
            const userReviews = currentData.reviews.filter(r => r.userId === user.id).length;
            const newBadges = await checkAndAwardBadges(user, { reviewCount: userReviews }, currentData);
             if (newBadges.length > 0) {
                user.badges = [...(user.badges || []), ...newBadges];
            }

            // Add history log
            currentData.pointHistory.push({
                id: `ph-${Date.now()}`,
                userId: user.id,
                amount: POINTS.REVIEW,
                reason: 'Opinión escrita',
                date: new Date().toISOString()
            });

            await fs.writeFile(DB_FILE, JSON.stringify(currentData, null, 2));
            res.json({ success: true, userPoints: user.points, newBadges });
        } else {
            // Just save review if user not found (weird)
            await fs.writeFile(DB_FILE, JSON.stringify(currentData, null, 2));
            res.json({ success: true });
        }
    });
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
