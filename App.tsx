
import React from 'react';
import { storageService } from './services/storageService';
import { User, Book, Transaction, UserRole, Review, AppSettings, PointHistory, BackupData } from './types';
import { AdminView } from './components/AdminView';
import { StudentView } from './components/StudentView';
import { Button } from './components/Button';
import { QRScanner } from './components/QRScanner';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { QrCode, WifiOff, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // --- Global State (Inicializado vacío) ---
  const [users, setUsers] = React.useState<User[]>([]);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [pointHistory, setPointHistory] = React.useState<PointHistory[]>([]);
  const [settings, setSettings] = React.useState<AppSettings>({ schoolName: '', logoUrl: '' });
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);

  // --- App System State ---
  const [isLoaded, setIsLoaded] = React.useState(false); // ¿Ya cargamos los datos del servidor?
  const [connectionError, setConnectionError] = React.useState(false);

  // --- Auth State ---
  const [loginInput, setLoginInput] = React.useState('');
  const [passwordInput, setPasswordInput] = React.useState('');
  const [isAdminMode, setIsAdminMode] = React.useState(false);
  const [authError, setAuthError] = React.useState('');
  const [showQRScanner, setShowQRScanner] = React.useState(false);

  // --- Toast State ---
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  // --- Initialization (Load from Server) ---
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const data = await storageService.fetchAllData();
        if (data) {
           setUsers(data.users || []);
           setBooks(data.books || []);
           setTransactions(data.transactions || []);
           setReviews(data.reviews || []);
           setPointHistory(data.pointHistory || []);
           setSettings(data.settings || { schoolName: 'BiblioHispa', logoUrl: '' });
           setIsLoaded(true);
           setConnectionError(false);
        }
      } catch (err) {
        console.error("Error conectando con el servidor:", err);
        setConnectionError(true);
        addToast("❌ No se puede conectar con el servidor.", "error");
      }
    };
    loadData();
  }, []);

  // --- Persistance Effects (Save to Server) ---
  // Solo guardamos si ya hemos cargado los datos iniciales (para evitar sobrescribir con arrays vacíos)
  // Usamos un pequeño debounce implícito por React batching, pero idealmente sería mejor un debounce real.
  
  React.useEffect(() => { if(isLoaded) storageService.setUsers(users).catch(() => setConnectionError(true)); }, [users, isLoaded]);
  React.useEffect(() => { if(isLoaded) storageService.setBooks(books).catch(() => setConnectionError(true)); }, [books, isLoaded]);
  React.useEffect(() => { if(isLoaded) storageService.setTransactions(transactions).catch(() => setConnectionError(true)); }, [transactions, isLoaded]);
  React.useEffect(() => { if(isLoaded) storageService.setReviews(reviews).catch(() => setConnectionError(true)); }, [reviews, isLoaded]);
  React.useEffect(() => { if(isLoaded) storageService.setPointHistory(pointHistory).catch(() => setConnectionError(true)); }, [pointHistory, isLoaded]);
  React.useEffect(() => { if(isLoaded) storageService.setSettings(settings).catch(() => setConnectionError(true)); }, [settings, isLoaded]);

  // --- Toast Handler ---
  const addToast = (message: string, type: ToastType) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Actions ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (isAdminMode) {
      const adminUser = users.find(u => 
        (u.username === loginInput || u.username === loginInput.toLowerCase()) && 
        (u.role === UserRole.SUPERADMIN || u.role === UserRole.ADMIN)
      );

      if (adminUser) {
        if (adminUser.password === passwordInput) {
            setCurrentUser(adminUser);
            addToast(`Bienvenido, ${adminUser.firstName}`, 'info');
        } else {
            setAuthError('Contraseña incorrecta');
        }
      } else {
        setAuthError('Usuario administrador no encontrado.');
      }
    } else {
      const student = users.find(u => u.username === loginInput.toLowerCase() && u.role === UserRole.STUDENT);
      if (student) {
        setCurrentUser(student);
        addToast(`¡Hola de nuevo, ${student.firstName}! 👋`, 'success');
      } else {
        setAuthError('Usuario no encontrado. Usa nombre.apellido');
      }
    }
  };

  const handleQRLogin = (scannedText: string) => {
    const student = users.find(u => u.username === scannedText.toLowerCase() && u.role === UserRole.STUDENT);
    if (student) {
      setCurrentUser(student);
      setShowQRScanner(false);
      addToast(`¡Acceso con QR exitoso! Hola ${student.firstName}`, 'success');
    } else {
      addToast("❌ Código QR no válido o usuario no encontrado.", "error");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginInput('');
    setPasswordInput('');
    setAuthError('');
    addToast('Sesión cerrada correctamente', 'info');
  };

  // Generic updaters
  const addUsers = (newUsers: User[]) => setUsers(prev => [...prev, ...newUsers]);
  const updateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    addToast('Usuario actualizado correctamente', 'success');
  };
  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    setPointHistory(prev => prev.filter(h => h.userId !== id));
    addToast('Usuario eliminado', 'info');
  };
  const addBooks = (newBooks: Book[]) => setBooks(prev => [...prev, ...newBooks]);
  const deleteBook = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    addToast('Libro eliminado', 'info');
  };
  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    addToast('Configuración guardada', 'success');
  };

  const handleManualPointAdjustment = (userId: string, amount: number, reason: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) return { ...u, points: Math.max(0, u.points + amount) };
      return u;
    }));
    const newEntry: PointHistory = {
      id: `ph-${Date.now()}`,
      userId,
      amount,
      reason,
      date: new Date().toISOString()
    };
    setPointHistory(prev => [newEntry, ...prev]);
    addToast('Puntos actualizados correctamente', 'success');
  };

  const handleDeletePointEntry = (entryId: string) => {
    const entry = pointHistory.find(ph => ph.id === entryId);
    if (!entry) return;
    setUsers(prev => prev.map(u => {
      if (u.id === entry.userId) return { ...u, points: Math.max(0, u.points - entry.amount) }; 
      return u;
    }));
    setPointHistory(prev => prev.filter(ph => ph.id !== entryId));
    addToast('Registro de puntos eliminado', 'info');
  };

  const handleBorrow = (book: Book) => {
    if (!currentUser) return;
    if (book.unitsAvailable <= 0) {
      addToast('Lo sentimos, este libro está agotado temporalmente.', 'error');
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
    setBooks(prev => prev.map(b => {
      if (b.id === book.id) return { ...b, unitsAvailable: b.unitsAvailable - 1, readCount: b.readCount + 1 };
      return b;
    }));
    addToast(`Has sacado "${book.title}". ¡Disfruta la lectura! 📖`, 'success');
  };

  const handleReturn = (book: Book) => {
    if (!currentUser) return;
    const tx = transactions.find(t => t.bookId === book.id && t.userId === currentUser.id && t.active);
    if (!tx) return;
    setTransactions(prev => prev.map(t => {
      if (t.id === tx.id) return { ...t, active: false, dateReturned: new Date().toISOString() };
      return t;
    }));
    setBooks(prev => prev.map(b => {
      if (b.id === book.id) return { ...b, unitsAvailable: b.unitsAvailable + 1 };
      return b;
    }));
    const POINTS_PER_BOOK = 10;
    const pointEntry: PointHistory = {
      id: `ph-${Date.now()}`,
      userId: currentUser.id,
      amount: POINTS_PER_BOOK,
      reason: `Devolución: ${book.title}`,
      date: new Date().toISOString()
    };
    setPointHistory(prev => [pointEntry, ...prev]);
    setUsers(prev => prev.map(u => {
      if (u.id === currentUser.id) {
        const updatedUser = { ...u, points: u.points + POINTS_PER_BOOK, booksRead: u.booksRead + 1 };
        setCurrentUser(updatedUser);
        return updatedUser;
      }
      return u;
    }));
    addToast(`¡Libro devuelto! Has ganado +${POINTS_PER_BOOK} XP 🌟`, 'success');
  };

  const handleAddReview = (review: Review) => {
    setReviews(prev => [review, ...prev]);
    addToast('¡Gracias por tu opinión! ⭐', 'success');
  };

  const handleDeleteReview = (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id));
    addToast('Reseña eliminada', 'info');
  };

  const handleRestoreBackup = async (data: BackupData) => {
    try {
      await storageService.restoreBackup(data);
      // Reload page to fetch clean data from server
      window.location.reload();
    } catch (error) {
      console.error("Backup Restore Error:", error);
      addToast("❌ Error al restaurar en servidor.", "error");
    }
  };

  // --- Loading / Error States ---
  if (connectionError) {
      return (
          <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md border border-red-100">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                      <WifiOff size={40} />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 mb-2">Error de Conexión</h1>
                  <p className="text-slate-500 mb-6">No podemos conectar con el servidor de la biblioteca. Asegúrate de que el servidor está encendido.</p>
                  <Button onClick={() => window.location.reload()} className="w-full">Reintentar</Button>
              </div>
          </div>
      );
  }

  if (!isLoaded) {
      return (
          <div className="min-h-screen bg-brand-50 flex items-center justify-center">
              <div className="text-center animate-pulse">
                  <img src="/vite.svg" className="w-16 h-16 mx-auto mb-4 opacity-50" alt="logo"/>
                  <Loader2 size={40} className="text-brand-500 animate-spin mx-auto mb-2"/>
                  <p className="font-bold text-brand-700">Conectando a la biblioteca...</p>
              </div>
          </div>
      );
  }

  // --- Views ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4 relative overflow-hidden">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fun-yellow/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-3xl"></div>

        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 border border-slate-100 relative z-10">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-brand-50 rounded-2xl mb-4 border border-brand-100">
               <img src={settings.logoUrl || "https://cdn-icons-png.flaticon.com/512/3413/3413535.png"} alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-4xl font-display font-bold text-brand-900 mb-1">{settings.schoolName || 'Biblioteca'}</h1>
            <p className="text-slate-500">Tu puerta a mil aventuras</p>
          </div>

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

          {!isAdminMode && (
            <div className="mb-6">
               <Button onClick={() => setShowQRScanner(true)} className="w-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center gap-2 py-3 shadow-lg shadow-slate-300">
                  <QrCode size={20} /> Escanear Carnet
               </Button>
               <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-300 text-xs font-bold uppercase">O entra con tu nombre</span>
                  <div className="flex-grow border-t border-slate-100"></div>
               </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                {isAdminMode ? 'Usuario' : 'Tu nombre (ej: juan.garcia)'}
              </label>
              <input 
                type="text" 
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-slate-900 bg-white"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                autoFocus={isAdminMode}
                placeholder={isAdminMode ? 'superadmin' : 'juan.garcia'}
              />
            </div>
            {isAdminMode && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Contraseña</label>
                <input 
                  type="password" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-slate-900 bg-white"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}
            {authError && <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">{authError}</div>}
            <Button type="submit" className="w-full py-4 text-lg shadow-xl shadow-brand-500/20" size="lg">
              {isAdminMode ? 'Entrar al Panel' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-4">
             <p className="text-xs text-slate-400">Creado por <span className="font-bold text-brand-600">Javi Barrero</span></p>
          </div>
        </div>
        
        {showQRScanner && (
           <QRScanner onScanSuccess={handleQRLogin} onClose={() => setShowQRScanner(false)} />
        )}
      </div>
    );
  }

  if (currentUser.role === UserRole.SUPERADMIN || currentUser.role === UserRole.ADMIN) {
     return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
           <ToastContainer toasts={toasts} removeToast={removeToast} />
           <AdminView 
             currentUser={currentUser}
             users={users}
             books={books}
             reviews={reviews}
             pointHistory={pointHistory}
             settings={settings}
             transactions={transactions}
             onAddUsers={addUsers}
             onAddBooks={addBooks}
             onDeleteUser={deleteUser}
             onUpdateUser={updateUser}
             onDeleteBook={deleteBook}
             onDeleteReview={handleDeleteReview}
             onUpdateSettings={updateSettings}
             onShowToast={addToast}
             onAddPoints={handleManualPointAdjustment}
             onDeletePointEntry={handleDeletePointEntry}
             onRestoreBackup={handleRestoreBackup}
           />
           <div className="fixed bottom-6 right-6 z-50 no-print">
              <Button onClick={handleLogout} variant="danger" size="sm" className="shadow-lg">Cerrar Sesión</Button>
           </div>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
    </div>
  );
};

export default App;
