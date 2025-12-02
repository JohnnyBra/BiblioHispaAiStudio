
import React, { useState, useEffect } from 'react';
import { storageService } from './services/storageService';
import { User, Book, Transaction, UserRole, Review, AppSettings } from './types';
import { AdminView } from './components/AdminView';
import { StudentView } from './components/StudentView';
import { Button } from './components/Button';
import { BookOpen } from 'lucide-react';

const App: React.FC = () => {
  // --- Global State ---
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [settings, setSettings] = useState<AppSettings>(storageService.getSettings());
  const [adminPassword, setAdminPassword] = useState<string>(storageService.getAdminPassword());
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- Auth State ---
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [authError, setAuthError] = useState('');

  // --- Initialization ---
  useEffect(() => {
    setUsers(storageService.getUsers());
    setBooks(storageService.getBooks());
    setTransactions(storageService.getTransactions());
    setReviews(storageService.getReviews());
    setSettings(storageService.getSettings());
    setAdminPassword(storageService.getAdminPassword());
  }, []);

  // --- Persistance Effects ---
  useEffect(() => { if(users.length) storageService.setUsers(users); }, [users]);
  useEffect(() => { if(books.length) storageService.setBooks(books); }, [books]);
  useEffect(() => { if(transactions.length) storageService.setTransactions(transactions); }, [transactions]);
  useEffect(() => { if(reviews.length) storageService.setReviews(reviews); }, [reviews]);
  useEffect(() => { storageService.setSettings(settings); }, [settings]);
  useEffect(() => { storageService.setAdminPassword(adminPassword); }, [adminPassword]);

  // --- Actions ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (isAdminMode) {
      // Admin Login
      if (loginInput === 'admin' && passwordInput === adminPassword) {
        const admin = users.find(u => u.role === UserRole.ADMIN);
        if (admin) setCurrentUser(admin);
        else setAuthError('Configuración de admin corrupta.');
      } else {
        setAuthError('Contraseña incorrecta');
      }
    } else {
      // Student login: firstname.lastname
      const student = users.find(u => u.username === loginInput.toLowerCase() && u.role === UserRole.STUDENT);
      if (student) {
        setCurrentUser(student);
      } else {
        setAuthError('Usuario no encontrado. Usa nombre.apellido');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginInput('');
    setPasswordInput('');
    setAuthError('');
  };

  const addUsers = (newUsers: User[]) => {
    setUsers(prev => [...prev, ...newUsers]);
  };

  const updateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const addBooks = (newBooks: Book[]) => {
    setBooks(prev => [...prev, ...newBooks]);
  };

  const deleteBook = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  const updateAdminPassword = (newPwd: string) => {
    setAdminPassword(newPwd);
  };

  const handleBorrow = (book: Book) => {
    if (!currentUser) return;
    
    // Check limits
    if (book.unitsAvailable <= 0) {
      alert("No hay unidades disponibles");
      return;
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      bookId: book.id,
      dateBorrowed: new Date().toISOString(),
      active: true
    };

    setTransactions(prev => [...prev, newTx]);
    
    // Update Book Stock & Popularity
    setBooks(prev => prev.map(b => {
      if (b.id === book.id) {
        return {
          ...b,
          unitsAvailable: b.unitsAvailable - 1,
          readCount: b.readCount + 1
        };
      }
      return b;
    }));
  };

  const handleReturn = (book: Book) => {
    if (!currentUser) return;

    // Find transaction
    const tx = transactions.find(t => t.bookId === book.id && t.userId === currentUser.id && t.active);
    if (!tx) return;

    // Close Transaction
    setTransactions(prev => prev.map(t => {
      if (t.id === tx.id) {
        return { ...t, active: false, dateReturned: new Date().toISOString() };
      }
      return t;
    }));

    // Return Stock
    setBooks(prev => prev.map(b => {
      if (b.id === book.id) {
        return { ...b, unitsAvailable: b.unitsAvailable + 1 };
      }
      return b;
    }));

    // Award Points & Books Read
    const POINTS_PER_BOOK = 10;
    setUsers(prev => prev.map(u => {
      if (u.id === currentUser.id) {
        const updatedUser = { 
          ...u, 
          points: u.points + POINTS_PER_BOOK, 
          booksRead: u.booksRead + 1 
        };
        // Update local current user state too so UI reflects immediately
        setCurrentUser(updatedUser);
        return updatedUser;
      }
      return u;
    }));

    alert(`¡Libro devuelto! Has ganado ${POINTS_PER_BOOK} puntos.`);
  };

  const handleAddReview = (review: Review) => {
    setReviews(prev => [review, ...prev]);
  };

  const handleDeleteReview = (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  // --- Views ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fun-yellow/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-3xl"></div>

        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 border border-slate-100 relative z-10">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-brand-50 rounded-2xl mb-4 border border-brand-100">
               <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-4xl font-display font-bold text-brand-900 mb-1">{settings.schoolName}</h1>
            <p className="text-slate-500">Tu puerta a mil aventuras</p>
          </div>

          {/* Toggle Role */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isAdminMode ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}
              onClick={() => { setIsAdminMode(false); setAuthError(''); }}
            >
              Alumno
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isAdminMode ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}
              onClick={() => { setIsAdminMode(true); setAuthError(''); }}
            >
              Profe / Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                {isAdminMode ? 'Usuario' : 'Tu nombre (ej: juan.garcia)'}
              </label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-slate-700 bg-slate-50 focus:bg-white"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                autoFocus
              />
            </div>
            
            {isAdminMode && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Contraseña</label>
                <input 
                  type="password" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-slate-700 bg-slate-50 focus:bg-white"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="admin123"
                />
              </div>
            )}

            {authError && <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">{authError}</div>}

            <Button type="submit" className="w-full py-4 text-lg shadow-xl shadow-brand-500/20" size="lg">
              {isAdminMode ? 'Entrar al Panel' : '¡Empezar a Leer!'}
            </Button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-4">
             <p className="text-xs text-slate-400">Creado por <span className="font-bold text-brand-600">Javi Barrero</span></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {currentUser.role === UserRole.ADMIN ? (
        <AdminView 
          users={users}
          books={books}
          reviews={reviews}
          settings={settings}
          onAddUsers={addUsers}
          onAddBooks={addBooks}
          onDeleteUser={deleteUser}
          onUpdateUser={updateUser}
          onDeleteBook={deleteBook}
          onDeleteReview={handleDeleteReview}
          onUpdateSettings={updateSettings}
          onChangePassword={updateAdminPassword}
        />
      ) : (
        <StudentView 
          currentUser={currentUser}
          books={books}
          transactions={transactions}
          users={users}
          reviews={reviews}
          settings={settings}
          onBorrow={handleBorrow}
          onReturn={handleReturn}
          onAddReview={handleAddReview}
          onLogout={handleLogout}
        />
      )}
      
      {/* Logout button for Admin specifically usually in header, but global logout helper */}
      {currentUser.role === UserRole.ADMIN && (
        <div className="fixed bottom-6 right-6 z-50">
           <Button onClick={handleLogout} variant="danger" size="sm" className="shadow-lg">Cerrar Sesión</Button>
        </div>
      )}
    </div>
  );
};

export default App;
