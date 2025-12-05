
import { Book, User, Transaction, Review, AppSettings, PointHistory } from '../types';

// El servidor inyecta la URL base o usa relativa si estamos en producción
const API_URL = '/api';

// Función auxiliar para llamadas a la API
const apiCall = async (endpoint: string, method: 'GET' | 'POST', body?: any) => {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error(`Error en API (${endpoint}):`, error);
    throw error; // Propagar error para manejarlo en la UI (mostrar modo offline)
  }
};

export const storageService = {
  // Carga inicial de TODOS los datos
  fetchAllData: async () => {
    return await apiCall('/db', 'GET');
  },

  // Guardado granular (se llama cuando React detecta cambios)
  // Nota: Estas funciones ahora son ASÍNCRONAS.
  setUsers: async (users: User[]) => apiCall('/users', 'POST', users),
  setBooks: async (books: Book[]) => apiCall('/books', 'POST', books),
  setTransactions: async (txs: Transaction[]) => apiCall('/transactions', 'POST', txs),
  setReviews: async (reviews: Review[]) => apiCall('/reviews', 'POST', reviews),
  setPointHistory: async (history: PointHistory[]) => apiCall('/pointHistory', 'POST', history),
  setSettings: async (settings: AppSettings) => apiCall('/settings', 'POST', settings),
  
  // Para compatibilidad con backup completo
  restoreBackup: async (fullData: any) => apiCall('/restore', 'POST', fullData),

  // Métodos legacy (ya no se usan directamente para leer, pero mantenemos por compatibilidad de tipos si fuera necesario)
  getUsers: () => [],
  getBooks: () => [],
  getTransactions: () => [],
  getReviews: () => [],
  getPointHistory: () => [],
  getSettings: () => ({ schoolName: 'Cargando...', logoUrl: '' }),
};

export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, '.');
};
