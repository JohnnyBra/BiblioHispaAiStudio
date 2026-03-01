
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN', // Director / IT
  ADMIN = 'ADMIN',           // Teachers
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string; // generated: nombre.apellido1.apellido2 (spaces within each part become dots)
  password?: string; // Only for ADMIN/SUPERADMIN
  className: string; // e.g., "1A", "2B", "STAFF"
  classId?: string; // ID from external system
  role: UserRole;
  points: number;
  booksRead: number;
  badges?: string[]; // IDs of earned badges
  currentStreak?: number; // Days in a row
  lastActivityDate?: string; // ISO Date for streak calculation
  isTechnical?: boolean; // Can access global settings/stats
}

export interface Badge {
  id: string;
  name: string;
  icon: string; // Emoji or URL
  description: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  unitsTotal: number;
  unitsAvailable: number;
  shelf: string;
  coverUrl?: string;
  readCount: number;
  recommendedAge?: string; // e.g. "6-8", "+10", "TP"
  description?: string;
  isbn?: string;
  pageCount?: number;
  publisher?: string;
  publishedDate?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  bookId: string;
  dateBorrowed: string; // ISO date string
  dateReturned?: string; // ISO date string
  dueDate?: string; // ISO date string
  active: boolean;
}

export interface Review {
  id: string;
  bookId: string;
  userId: string;
  authorName: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface PointHistory {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  date: string;
}

export interface AppSettings {
  schoolName: string;
  logoUrl: string;
  studentUsernameLoginEnabled?: boolean; // default true; false = solo QR para alumnos
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
  booksRead: number;
}

// For CSV Import
export interface RawUserImport {
  nombre: string;
  apellido: string;
  clase: string;
}

export interface RawBookImport {
  titulo: string;
  autor: string;
  genero: string;
  unidades: number;
  estanteria: string;
}

export interface BackupData {
  version: string;
  timestamp: string;
  users: User[];
  books: Book[];
  transactions: Transaction[];
  reviews: Review[];
  pointHistory: PointHistory[];
  settings: AppSettings;
}
