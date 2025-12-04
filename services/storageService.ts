

import { Book, User, Transaction, UserRole, Review, AppSettings, PointHistory } from '../types';

const KEYS = {
  USERS: 'bibliohispa_users',
  BOOKS: 'bibliohispa_books',
  TRANSACTIONS: 'bibliohispa_transactions',
  REVIEWS: 'bibliohispa_reviews',
  POINT_HISTORY: 'bibliohispa_points_history',
  SETTINGS: 'bibliohispa_settings',
  ADMIN_PWD: 'bibliohispa_admin_pwd'
};

// Initial Mock Data
const INITIAL_USERS: User[] = [
  {
    id: 'admin-1',
    firstName: 'Admin',
    lastName: 'Principal',
    username: 'admin',
    className: 'STAFF',
    role: UserRole.ADMIN,
    points: 0,
    booksRead: 0
  },
  {
    id: 'student-1',
    firstName: 'Juan',
    lastName: 'García',
    username: 'juan.garcia',
    className: '3A',
    role: UserRole.STUDENT,
    points: 150,
    booksRead: 15
  },
  {
    id: 'student-2',
    firstName: 'María',
    lastName: 'López',
    username: 'maria.lopez',
    className: '4B',
    role: UserRole.STUDENT,
    points: 320,
    booksRead: 32
  }
];

const INITIAL_BOOKS: Book[] = [
  {
    id: 'b1',
    title: 'El Principito',
    author: 'Antoine de Saint-Exupéry',
    genre: 'Fantasía',
    unitsTotal: 5,
    unitsAvailable: 4,
    shelf: 'A1',
    coverUrl: 'https://books.google.com/books/content?id=N7R8DwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
    readCount: 120,
    recommendedAge: '6-8'
  },
  {
    id: 'b2',
    title: 'Don Quijote de la Mancha',
    author: 'Miguel de Cervantes',
    genre: 'Clásico',
    unitsTotal: 3,
    unitsAvailable: 3,
    shelf: 'C2',
    coverUrl: 'https://books.google.com/books/content?id=Z-xbAAAAMAAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
    readCount: 45,
    recommendedAge: '+12'
  },
  {
    id: 'b3',
    title: 'Harry Potter y la Piedra Filosofal',
    author: 'J.K. Rowling',
    genre: 'Fantasía',
    unitsTotal: 8,
    unitsAvailable: 2,
    shelf: 'F5',
    coverUrl: 'https://books.google.com/books/content?id=5iTebBW-w7QC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
    readCount: 200,
    recommendedAge: '9-11'
  }
];

const INITIAL_SETTINGS: AppSettings = {
  schoolName: 'BiblioHispa',
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/3413/3413535.png' // Default school icon
};

export const getStorage = <T>(key: string, initial: T): T => {
  const saved = localStorage.getItem(key);
  if (saved) {
    return JSON.parse(saved);
  }
  localStorage.setItem(key, JSON.stringify(initial));
  return initial;
};

export const setStorage = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const storageService = {
  getUsers: () => getStorage<User[]>(KEYS.USERS, INITIAL_USERS),
  setUsers: (users: User[]) => setStorage(KEYS.USERS, users),

  getBooks: () => getStorage<Book[]>(KEYS.BOOKS, INITIAL_BOOKS),
  setBooks: (books: Book[]) => setStorage(KEYS.BOOKS, books),

  getTransactions: () => getStorage<Transaction[]>(KEYS.TRANSACTIONS, []),
  setTransactions: (txs: Transaction[]) => setStorage(KEYS.TRANSACTIONS, txs),

  getReviews: () => getStorage<Review[]>(KEYS.REVIEWS, []),
  setReviews: (reviews: Review[]) => setStorage(KEYS.REVIEWS, reviews),

  getPointHistory: () => getStorage<PointHistory[]>(KEYS.POINT_HISTORY, []),
  setPointHistory: (history: PointHistory[]) => setStorage(KEYS.POINT_HISTORY, history),

  getSettings: () => getStorage<AppSettings>(KEYS.SETTINGS, INITIAL_SETTINGS),
  setSettings: (settings: AppSettings) => setStorage(KEYS.SETTINGS, settings),

  getAdminPassword: () => getStorage<string>(KEYS.ADMIN_PWD, 'admin123'),
  setAdminPassword: (pwd: string) => setStorage(KEYS.ADMIN_PWD, pwd),
};

export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, '.');
};