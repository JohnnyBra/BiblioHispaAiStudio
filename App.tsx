
import React from 'react';
import { storageService } from './services/storageService';
import * as bookService from './services/bookService';
import * as userService from './services/userService';
import * as authService from './services/authService';
import { checkoutBook, returnBook, submitReview } from './services/gamificationService';
import { User, Book, Transaction, UserRole, Review, AppSettings, PointHistory, BackupData } from './types';
import { AdminView } from './components/AdminView';
import { StudentView } from './components/StudentView';
import { Button } from './components/Button';
import { QRScanner } from './components/QRScanner';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { QrCode, WifiOff, Loader2, ArrowLeft } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';

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
  const [isAdminMode, setIsAdminMode] = React.useState(false); // Mode selection tab
  const [isManualLogin, setIsManualLogin] = React.useState(false); // Toggle between Google/Manual in Admin Mode
  const [authError, setAuthError] = React.useState('');
  const [showQRScanner, setShowQRScanner] = React.useState(false);

  // --- Toast State ---
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const isGoogleConfigured = import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID";

  // --- Initialization (Load from Server) ---
  React.useEffect(() => {
    if (!isGoogleConfigured) {
      console.warn("⚠️ VITE_GOOGLE_CLIENT_ID is missing or invalid. Google Sign-In will not work.");
    }
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

  // --- Restore Session ---
  React.useEffect(() => {
    if (isLoaded && !currentUser) {
      const storedUserId = localStorage.getItem('biblio_session_user');
      if (storedUserId) {
        const foundUser = users.find(u => u.id === storedUserId);
        if (foundUser) {
          setCurrentUser(foundUser);
        }
      }
    }
  }, [isLoaded, users]);

  // --- Persistance Effects (Save to Server) ---
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (isAdminMode) {
      // ACCESO PROFESORES MANUAL (PrismaEdu Check)
      try {
        const result = await userService.teacherLogin(loginInput, passwordInput);
        if (result.success && result.user) {
           setCurrentUser(result.user);
           // Update local user list with the new teacher if not present (or update details)
           setUsers(prev => {
              const idx = prev.findIndex(u => u.id === result.user!.id);
              if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = result.user!;
                  return copy;
              }
              return [...prev, result.user!];
           });

           localStorage.setItem('biblio_session_user', result.user.id);
           addToast(`Bienvenido, ${result.user.firstName}`, 'info');

           // Trigger sync
           syncPrismaData();

        } else {
           setAuthError(result.error || 'Credenciales incorrectas');
        }
      } catch (err) {
        setAuthError('Error de conexión con el sistema de autenticación');
      }
    } else {
      // ACCESO ALUMNOS (Local)
      const student = users.find(u => u.username === loginInput.toLowerCase() && u.role === UserRole.STUDENT);
      if (student) {
        setCurrentUser(student);
        localStorage.setItem('biblio_session_user', student.id);
        addToast(`¡Hola de nuevo, ${student.firstName}! 👋`, 'success');
      } else {
        setAuthError('Usuario no encontrado. Usa nombre.apellido');
      }
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
     try {
         if (credentialResponse.credential) {
             // Verify against Prisma
             const result = await authService.verifyGoogleToken(credentialResponse.credential);

             if (result.success && result.user) {
                setCurrentUser(result.user);

                // Update local list
                setUsers(prev => {
                    const idx = prev.findIndex(u => u.id === result.user!.id);
                    if (idx >= 0) {
                        const copy = [...prev];
                        copy[idx] = result.user!;
                        return copy;
                    }
                    return [...prev, result.user!];
                });

                localStorage.setItem('biblio_session_user', result.user.id);
                addToast(`Bienvenido, ${result.user.firstName}`, 'info');

                // Trigger sync
                syncPrismaData();
             } else {
                 setAuthError(result.error || 'No tienes permisos para acceder.');
             }
         }
     } catch (e) {
         console.error(e);
         setAuthError('Error validando el inicio de sesión con Google.');
     }
  };

  const syncPrismaData = async () => {
      try {
          addToast('Sincronizando con PrismaEdu...', 'info');
          const result = await userService.syncStudents();
          if (result.success) {
              addToast(`Sincronización completada: ${result.updated} actualizados, ${result.created} nuevos.`, 'success');
              // Reload local data?
              const data = await storageService.fetchAllData();
              if (data && data.users) setUsers(data.users);
          }
      } catch (e) {
          console.error(e);
          // Don't disturb user too much if sync fails in background
      }
  };

  const handleQRLogin = (scannedText: string) => {
    const student = users.find(u => u.username === scannedText.toLowerCase() && u.role === UserRole.STUDENT);
    if (student) {
      setCurrentUser(student);
      localStorage.setItem('biblio_session_user', student.id);
      setShowQRScanner(false);
      addToast(`¡Acceso con QR exitoso! Hola ${student.firstName}`, 'success');
    } else {
      addToast("❌ Código QR no válido o usuario no encontrado.", "error");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('biblio_session_user');
    setLoginInput('');
    setPasswordInput('');
    setAuthError('');
    setIsAdminMode(false);
    setIsManualLogin(false);
    addToast('Sesión cerrada correctamente', 'info');
  };

  // Generic updaters
  const addUsers = async (newUsers: User[]) => {
      try {
          if (newUsers.length === 1) {
              await userService.addUser(newUsers[0]);
          } else if (newUsers.length > 1) {
              await userService.importUsers(newUsers);
          }
          setUsers(prev => [...prev, ...newUsers]);
      } catch (e) {
          console.error(e);
          addToast('Error guardando usuarios en servidor', 'error');
      }
  };

  const updateUser = async (updatedUser: User) => {
    try {
        await userService.updateUser(updatedUser);
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        addToast('Usuario actualizado correctamente', 'success');
    } catch (e) {
        addToast('Error actualizando usuario', 'error');
    }
  };

  const deleteUser = async (id: string) => {
    try {
        await userService.deleteUser(id);
        setUsers(prev => prev.filter(u => u.id !== id));
        setPointHistory(prev => prev.filter(h => h.userId !== id));
        addToast('Usuario eliminado', 'info');
    } catch (e) {
        addToast('Error eliminando usuario', 'error');
    }
  };

  const addBooks = async (newBooks: Book[]) => {
      try {
          if (newBooks.length === 1) {
             await bookService.addBook(newBooks[0]);
          } else {
             await bookService.importBooks(newBooks);
          }
          setBooks(prev => [...prev, ...newBooks]);
      } catch (e) {
          console.error(e);
          addToast('Error guardando libros', 'error');
      }
  };

  const handleUpdateBook = async (updatedBook: Book) => {
    try {
        await bookService.updateBook(updatedBook);
        setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
        addToast('Libro actualizado', 'success');
    } catch (e) {
        addToast('Error actualizando libro', 'error');
    }
  };

  const deleteBook = async (id: string) => {
    try {
        await bookService.deleteBook(id);
        setBooks(prev => prev.filter(b => b.id !== id));
        addToast('Libro eliminado', 'info');
    } catch (e) {
        addToast('Error eliminando libro', 'error');
    }
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

  const handleBorrow = async (book: Book) => {
    if (!currentUser) return;
    if (book.unitsAvailable <= 0) {
      addToast('Lo sentimos, este libro está agotado temporalmente.', 'error');
      return;
    }

    // Check Limits (Frontend Validation)
    const activeLoans = transactions.filter(t => t.userId === currentUser.id && t.active).length;
    const className = (currentUser.className || '').toUpperCase();
    let maxBooks = 3;
    if (className.includes('AÑOS')) {
        maxBooks = 1;
    } else if (className.includes('PRIMARIA')) {
        maxBooks = 2;
    } else if (className.includes('SECUNDARIA')) {
        maxBooks = 3;
    }

    if (activeLoans >= maxBooks) {
         addToast(`Has alcanzado el límite de ${maxBooks} libros prestados. Devuelve uno para sacar otro.`, 'error');
         return;
    }

    // Optimistic Update
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, unitsAvailable: b.unitsAvailable - 1 } : b));

    try {
        const result = await checkoutBook(currentUser.id, book.id);
        if (result.success) {
            setTransactions(prev => [...prev, result.transaction]);
            setUsers(prev => prev.map(u => {
                if (u.id === currentUser.id) {
                    const updated = { ...u, points: result.userPoints, badges: result.newBadges.length > 0 ? [...(u.badges||[]), ...result.newBadges] : u.badges };
                    if (result.newBadges.length > 0) addToast(`¡Nueva Insignia Conseguida! 🏆`, 'success');
                    setCurrentUser(updated);
                    return updated;
                }
                return u;
            }));
            addToast(`Has sacado "${book.title}". ¡Disfruta la lectura! 📖`, 'success');
        }
    } catch (e: any) {
        console.error(e);

        // Revert Optimistic Update
        setBooks(prev => prev.map(b => b.id === book.id ? { ...b, unitsAvailable: b.unitsAvailable + 1 } : b));

        // Parse Error Message
        let errorMessage = 'Error al procesar el préstamo';
        try {
            if (e.message) {
                 const parsed = JSON.parse(e.message);
                 if (parsed.error) errorMessage = parsed.error;
            }
        } catch (parseError) {
             // Fallback to generic or raw message if needed
        }
        addToast(errorMessage, 'error');
    }
  };

  const handleReturn = async (book: Book) => {
    if (!currentUser) return;

    // Optimistic update
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, unitsAvailable: b.unitsAvailable + 1 } : b));
    setTransactions(prev => prev.map(t => (t.bookId === book.id && t.userId === currentUser.id && t.active) ? { ...t, active: false, dateReturned: new Date().toISOString() } : t));

    try {
        const result = await returnBook(currentUser.id, book.id);
        if (result.success) {
            setUsers(prev => prev.map(u => {
                if (u.id === currentUser.id) {
                    const updated = { ...u, points: result.userPoints, badges: result.newBadges.length > 0 ? [...(u.badges||[]), ...result.newBadges] : u.badges };
                     if (result.newBadges.length > 0) addToast(`¡Nueva Insignia Conseguida! 🏆`, 'success');
                    setCurrentUser(updated);
                    return updated;
                }
                return u;
            }));
             addToast(`¡Libro devuelto! Puntos actualizados. 🌟`, 'success');
        }
    } catch (e) {
         console.error(e);
         addToast('Error al procesar la devolución', 'error');
    }
  };

  const handleAddReview = async (review: Review) => {
    setReviews(prev => [review, ...prev]); // Optimistic

    try {
        const result = await submitReview(review);
         if (result.success && result.userPoints) {
            setUsers(prev => prev.map(u => {
                if (u.id === currentUser.id) {
                     const updated = { ...u, points: result.userPoints, badges: result.newBadges?.length > 0 ? [...(u.badges||[]), ...result.newBadges] : u.badges };
                     if (result.newBadges?.length > 0) addToast(`¡Nueva Insignia Conseguida! 🏆`, 'success');
                     setCurrentUser(updated);
                     return updated;
                }
                return u;
            }));
        }
        addToast('¡Gracias por tu opinión! ⭐', 'success');
    } catch (e) {
        console.error(e);
        addToast('Error al guardar la opinión', 'error');
    }
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
          <div className="min-h-screen flex items-center justify-center p-4">
              <div className="glass-panel p-8 rounded-3xl text-center max-w-md border border-red-100/50">
                  <div className="w-20 h-20 bg-red-50/50 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
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
     <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"}>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <a href="https://prisma.bibliohispa.es/" className="absolute top-4 left-4 z-50 bg-white/80 hover:bg-white p-3 rounded-full shadow-md text-slate-500 hover:text-brand-600 transition-all hover:scale-110 backdrop-blur-sm" title="Volver a Prisma">
          <ArrowLeft size={24} />
        </a>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fun-yellow/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-3xl"></div>

        <div className="glass-panel max-w-md w-full rounded-3xl p-8 relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-white/50 backdrop-blur-sm rounded-2xl mb-4 shadow-sm">
               <img src={settings.logoUrl || "https://cdn-icons-png.flaticon.com/512/3413/3413535.png"} alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-4xl font-display font-bold text-slate-800 mb-1">{settings.schoolName || 'Biblioteca'}</h1>
            <p className="text-slate-600 font-medium">Tu puerta a mil aventuras</p>
          </div>

          <div className="flex bg-slate-100/50 backdrop-blur-sm p-1 rounded-xl mb-6 border border-white/20">
            <button 
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${!isAdminMode ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setIsAdminMode(false); setAuthError(''); }}
            >
              ACCESO ALUMNOS
            </button>
            <button 
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${isAdminMode ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setIsAdminMode(true); setAuthError(''); setIsManualLogin(false); }}
            >
              ACCESO PROFESORES
            </button>
          </div>

          {!isAdminMode && (
            <div className="mb-6">
               <Button onClick={() => setShowQRScanner(true)} className="w-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center gap-2 py-3 shadow-lg shadow-slate-300">
                  <QrCode size={20} /> Escanear Carnet
               </Button>
               <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t border-slate-200/50"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">O entra con tu nombre</span>
                  <div className="flex-grow border-t border-slate-200/50"></div>
               </div>
            </div>
          )}

          {/* LOGIN FORMS */}
          {isAdminMode ? (
             <div className="space-y-4">
                 {!isGoogleConfigured && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold mb-2">
                        ⚠️ Error: Google Client ID no configurado o inválido. Revisa .env y ejecuta 'npm run build'.
                    </div>
                 )}
                 {!isManualLogin ? (
                     <>
                        <div className="flex flex-col gap-3">
                           <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => setAuthError('Login Fallido')}
                                useOneTap
                                containerProps={{ className: 'w-full flex justify-center' }}
                            />
                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-slate-200/50"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase">O</span>
                                <div className="flex-grow border-t border-slate-200/50"></div>
                            </div>
                            <Button
                                variant="secondary"
                                className="w-full border border-slate-200 bg-white/50 backdrop-blur-sm"
                                onClick={() => setIsManualLogin(true)}
                            >
                                Usar Contraseña Manual
                            </Button>
                        </div>
                     </>
                 ) : (
                    <form onSubmit={handleLogin} className="space-y-4 animate-fadeIn">
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario Prisma</label>
                            <input
                              type="text"
                              className="w-full p-3 rounded-xl glass-input outline-none transition-all font-medium text-slate-900"
                              value={loginInput}
                              onChange={(e) => setLoginInput(e.target.value)}
                              autoFocus
                              placeholder="Usuario"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña / PIN</label>
                            <input
                              type="password"
                              className="w-full p-3 rounded-xl glass-input outline-none transition-all font-medium text-slate-900"
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                              placeholder="••••••••"
                            />
                          </div>
                          <Button type="submit" className="w-full py-4 text-lg shadow-xl shadow-brand-500/20" size="lg">
                            Entrar
                          </Button>
                          <button
                             type="button"
                             className="text-xs text-brand-600 font-bold hover:underline w-full text-center"
                             onClick={() => setIsManualLogin(false)}
                          >
                             Volver a Google Login
                          </button>
                    </form>
                 )}
             </div>
          ) : (
             /* STUDENT MANUAL LOGIN */
             <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tu nombre (ej: juan.garcia)</label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-xl glass-input outline-none transition-all font-medium text-slate-900"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="juan.garcia"
                  />
                </div>
                <Button type="submit" className="w-full py-4 text-lg shadow-xl shadow-brand-500/20" size="lg">
                  Entrar
                </Button>
             </form>
          )}

          {authError && <div className="mt-4 text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">{authError}</div>}


          <div className="mt-8 text-center border-t border-slate-200/50 pt-4">
             <p className="text-xs text-slate-400">Creado por <span className="font-bold text-brand-600">Javi Barrero</span></p>
          </div>
        </div>
        
        {showQRScanner && (
           <QRScanner onScanSuccess={handleQRLogin} onClose={() => setShowQRScanner(false)} />
        )}
      </div>
      </GoogleOAuthProvider>
    );
  }

  // --- Authenticated Views ---

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
             onUpdateBook={handleUpdateBook}
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
