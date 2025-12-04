export enum UserRole {
  SUPERADMIN = 'SUPERADMIN', // Director / IT
  ADMIN = 'ADMIN',           // Teachers
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string; // generated: firstname.lastname
  password?: string; // Only for ADMIN/SUPERADMIN
  className: string; // e.g., "1A", "2B", "STAFF"
  role: UserRole;
  points: number;
  booksRead: number;
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
}

export interface Transaction {
  id: string;
  userId: string;
  bookId: string;
  dateBorrowed: string; // ISO date string
  dateReturned?: string; // ISO date string
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
