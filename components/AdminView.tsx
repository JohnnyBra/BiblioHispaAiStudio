
import * as React from 'react';
import { User, Book, RawUserImport, RawBookImport, UserRole, Review, AppSettings, PointHistory, Transaction, BackupData } from '../types';
import { normalizeString } from '../services/storageService';
import { searchBookCover, determineBookAge, searchBookMetadata, searchBookCandidates, updateBook, deleteBook, addBook } from '../services/bookService';
import { Button } from './Button';
import { IDCard } from './IDCard';
import { ToastType } from './Toast';
import { Upload, Plus, Trash2, Users, BookOpen, BarChart3, Search, Loader2, Edit2, X, Save, MessageSquare, Settings, Check, Image as ImageIcon, Lock, Key, CreditCard, Printer, Trophy, History, RefreshCcw, UserPlus, Shield, Clock, Download, AlertTriangle, ArrowRight, Wand2 } from 'lucide-react';

interface AdminViewProps {
  currentUser: User; // The currently logged in admin/superadmin
  users: User[];
  books: Book[];
  reviews?: Review[];
  pointHistory: PointHistory[];
  settings: AppSettings;
  transactions?: Transaction[];
  onAddUsers: (users: User[]) => void;
  onAddBooks: (books: Book[]) => void;
  onDeleteUser: (id: string) => void;
  onDeleteBook: (id: string) => void;
  onUpdateBook: (book: Book) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onDeleteReview?: (id: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onShowToast: (message: string, type: ToastType) => void;
  onAddPoints: (userId: string, amount: number, reason: string) => void;
  onDeletePointEntry: (entryId: string) => void;
  onRestoreBackup: (data: BackupData) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  users,
  books,
  reviews = [],
  pointHistory,
  settings,
  transactions = [],
  onAddUsers,
  onAddBooks,
  onDeleteUser,
  onDeleteBook,
  onUpdateBook,
  onUpdateUser,
  onDeleteReview,
  onUpdateSettings,
  onShowToast,
  onAddPoints,
  onDeletePointEntry,
  onRestoreBackup
}) => {
  const [activeTab, setActiveTab] = React.useState<'users' | 'books' | 'reviews' | 'stats' | 'settings' | 'cards' | 'teachers' | 'history'>('users');
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Single Entry States
  const [newUser, setNewUser] = React.useState({ name: '', lastname: '', className: '' });

  // Add Book State
  const [newBook, setNewBook] = React.useState<Partial<Book>>({ unitsTotal: 1, unitsAvailable: 1, shelf: 'Recepción' });
  const [candidates, setCandidates] = React.useState<Partial<Book>[]>([]);
  const [showCandidates, setShowCandidates] = React.useState(false);
  const [isCoverSelectionMode, setIsCoverSelectionMode] = React.useState(false);

  // Edit Book State
  const [editingBook, setEditingBook] = React.useState<Book | null>(null);

  const [newTeacher, setNewTeacher] = React.useState({ name: '', username: '', password: '' });
  
  // Import Config State
  const [importClassName, setImportClassName] = React.useState('');
  const [csvEncoding, setCsvEncoding] = React.useState<string>('windows-1252');
  
  // Edit User State
  const [editingUser, setEditingUser] = React.useState<User | null>(null);

  // Points Management State
  const [managingPointsUser, setManagingPointsUser] = React.useState<User | null>(null);
  const [pointsAmount, setPointsAmount] = React.useState<number>(0);
  const [pointsReason, setPointsReason] = React.useState<string>('');

  // Settings State
  const [tempSettings, setTempSettings] = React.useState<AppSettings>(settings);
  const [settingsSaved, setSettingsSaved] = React.useState(false);
  const [newAdminPassword, setNewAdminPassword] = React.useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = React.useState('');
  const [passwordSaved, setPasswordSaved] = React.useState(false);
  
  // ID Cards State
  const [cardClassFilter, setCardClassFilter] = React.useState<string>('all');
  const [cardPrintMode, setCardPrintMode] = React.useState<'class' | 'individual'>('class');
  const [cardSearchTerm, setCardSearchTerm] = React.useState('');
  const [showBackSide, setShowBackSide] = React.useState(false);

  // Books Filter State
  const [shelfFilter, setShelfFilter] = React.useState<string>('all');
  
  // Loading States
  const [isAddingBook, setIsAddingBook] = React.useState(false);
  const [isImportingBooks, setIsImportingBooks] = React.useState(false);
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [loadingMessage, setLoadingMessage] = React.useState('');

  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;

  // References for file inputs
  const userFileInputRef = React.useRef<HTMLInputElement>(null);
  const bookFileInputRef = React.useRef<HTMLInputElement>(null);
  const backupInputRef = React.useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleUserCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!importClassName.trim()) {
      onShowToast("⚠️ Por favor, escribe el nombre de la CLASE antes de subir el archivo.", "error");
      if (userFileInputRef.current) userFileInputRef.current.value = ''; 
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      
      if (lines.length === 0) return;

      const parsedUsers: User[] = [];
      const targetClass = importClassName.trim();
      let importedCount = 0;
      
      const looksLikeSurnameCommaName = lines.slice(0, 5).every(l => l.includes(',') && !l.includes(';'));

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.toLowerCase().includes('nombre') && line.toLowerCase().includes('apellido')) continue;

        let firstName = '';
        let lastName = '';

        if (looksLikeSurnameCommaName) {
           const parts = line.split(',');
           if (parts.length >= 2) {
             lastName = parts[0].trim();
             firstName = parts[1].trim();
           }
        } else {
           const parts = line.split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
           if (parts.length >= 2) {
             lastName = parts[0];
             firstName = parts[1];
           }
        }

        if (firstName && lastName) {
           const generatedUsername = `${normalizeString(firstName)}.${normalizeString(lastName)}`;
           parsedUsers.push({
            id: `user-${Date.now()}-${i}-${Math.random().toString(36).substr(2,4)}`,
            firstName,
            lastName,
            username: generatedUsername,
            className: targetClass, 
            role: UserRole.STUDENT,
            points: 0,
            booksRead: 0
          });
          importedCount++;
        }
      }
      
      if (parsedUsers.length > 0) {
        onAddUsers(parsedUsers);
        onShowToast(`✅ Se han importado ${importedCount} alumnos a la clase "${targetClass}".`, "success");
        setImportClassName(''); 
      } else {
        onShowToast("⚠️ No se pudieron leer usuarios. Verifica el formato.", "error");
      }
    };
    reader.readAsText(file, csvEncoding);
    if (userFileInputRef.current) userFileInputRef.current.value = '';
  };

  const handleBookCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingBooks(true);
    setLoadingProgress(0);
    setLoadingMessage("Iniciando lectura del archivo...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      const startIndex = lines[0].toLowerCase().includes('titulo') ? 1 : 0;
      const totalToProcess = lines.length - startIndex;
      const parsedBooks: Book[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
        
        if (parts.length >= 2) { 
          const title = parts[0];
          const author = parts[1];
          const genre = parts[2] || 'General';
          const units = parseInt(parts[3]) || 1;
          const shelf = parts[4] || 'Recepción';
          const ageFromCsv = parts[5] || '';

          if (title) {
            setLoadingProgress(Math.round(((i - startIndex) / totalToProcess) * 100));
            setLoadingMessage(`Procesando (${i - startIndex + 1}/${totalToProcess}): "${title}"`);
            
            try {
                // If Author or Genre are missing or generic, we try to fetch metadata
                // But we always fetch to get Cover/Synopsis if possible.
                const meta = await searchBookMetadata(title);
                
                parsedBooks.push({
                  id: `book-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
                  title: title, // Always trust CSV title
                  author: (!author || author === 'Desconocido') ? (meta.author || 'Desconocido') : author,
                  genre: (!genre || genre === 'General') ? (meta.genre || 'General') : genre,
                  unitsTotal: units,
                  unitsAvailable: units,
                  shelf,
                  coverUrl: meta.coverUrl || undefined,
                  readCount: 0,
                  recommendedAge: ageFromCsv || meta.recommendedAge || '6-8',
                  description: meta.description,
                  isbn: meta.isbn,
                  pageCount: meta.pageCount,
                  publisher: meta.publisher,
                  publishedDate: meta.publishedDate
                });
            } catch (err) {
                console.error(`Error processing ${title}`, err);
                // Fallback basic
                parsedBooks.push({
                    id: `book-${Date.now()}-${i}`,
                    title, author, genre, unitsTotal: units, unitsAvailable: units, shelf, readCount: 0
                });
            }
          }
        }
      }
      setIsImportingBooks(false);
      setLoadingProgress(100);
      setLoadingMessage("¡Completado!");
      onAddBooks(parsedBooks);
      onShowToast(`✅ Se han importado ${parsedBooks.length} libros correctamente.`, "success");
    };
    reader.readAsText(file, csvEncoding);
    if (bookFileInputRef.current) bookFileInputRef.current.value = '';
  };

  const handleAddSingleUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.lastname || !newUser.className) return;
    
    const user: User = {
      id: `user-${Date.now()}`,
      firstName: newUser.name,
      lastName: newUser.lastname,
      username: `${normalizeString(newUser.name)}.${normalizeString(newUser.lastname)}`,
      className: newUser.className,
      role: UserRole.STUDENT,
      points: 0,
      booksRead: 0
    };
    onAddUsers([user]);
    setNewUser({ name: '', lastname: '', className: '' });
    onShowToast(`Usuario ${user.firstName} creado`, "success");
  };

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!newTeacher.name || !newTeacher.username || !newTeacher.password) {
        onShowToast("Todos los campos son obligatorios", "error");
        return;
    }

    // Check username uniqueness
    if (users.some(u => u.username === newTeacher.username)) {
        onShowToast("Ese nombre de usuario ya existe.", "error");
        return;
    }

    const teacher: User = {
        id: `admin-${Date.now()}`,
        firstName: newTeacher.name,
        lastName: '(Profesor)',
        username: newTeacher.username,
        password: newTeacher.password,
        className: 'PROFESORADO',
        role: UserRole.ADMIN, // Create as regular admin (teacher)
        points: 0,
        booksRead: 0
    };
    
    onAddUsers([teacher]);
    setNewTeacher({ name: '', username: '', password: '' });
    onShowToast(`Profesor ${teacher.firstName} creado correctamente.`, "success");
  };

  // --- NEW ADD BOOK FLOW ---
  const handleSearchCandidates = async (e: React.FormEvent | React.MouseEvent) => {
      if (e) e.preventDefault();
      if (!newBook.title) {
          onShowToast("Escribe al menos el título para buscar", "error");
          return;
      }

      setIsAddingBook(true);
      setLoadingMessage("Buscando candidatos...");

      try {
          const results = await searchBookCandidates(newBook.title + (newBook.author ? ` ${newBook.author}` : ''));
          setCandidates(results);
          if (results.length === 0) {
              onShowToast("No se encontraron libros.", "info");
          } else {
              setShowCandidates(true);
          }
      } catch (error) {
          onShowToast("Error en la búsqueda.", "error");
      } finally {
          setIsAddingBook(false);
      }
  };

  const handleSelectCandidate = (candidate: Partial<Book>) => {
      if (isCoverSelectionMode && editingBook) {
          setEditingBook(prev => prev ? ({ ...prev, coverUrl: candidate.coverUrl }) : null);
          setShowCandidates(false);
          setIsCoverSelectionMode(false);
          onShowToast("Portada actualizada.", "success");
          return;
      }

      const targetSetter = editingBook ? setEditingBook : setNewBook;
      targetSetter((prev: any) => ({
          ...prev,
          ...candidate,
          // Preserve existing fields if they exist in prev but not in candidate
          unitsTotal: prev.unitsTotal || 1,
          unitsAvailable: prev.unitsTotal || 1,
          shelf: prev.shelf || 'Recepción'
      }));
      setShowCandidates(false);
      onShowToast("Datos rellenados. Puedes editar antes de guardar.", "success");
  };

  const handleBlur = () => {
      if (newBook.title && !newBook.coverUrl) {
          handleSearchCandidates(null as any);
      }
  };

  const handleSaveBook = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newBook.title) {
          onShowToast("El título es obligatorio.", "error");
          return;
      }

      if (!newBook.author) {
          if (confirm("¿Autor vacío. Quieres buscarlo automáticamente?")) {
              handleSearchCandidates(null as any);
              return;
          }
      }

      const book: Book = {
          id: `book-${Date.now()}`,
          title: newBook.title,
          author: newBook.author || 'Desconocido',
          genre: newBook.genre || 'General',
          unitsTotal: newBook.unitsTotal || 1,
          unitsAvailable: newBook.unitsTotal || 1,
          shelf: newBook.shelf || 'Recepción',
          coverUrl: newBook.coverUrl,
          readCount: 0,
          recommendedAge: newBook.recommendedAge || '6-8',
          description: newBook.description,
          isbn: newBook.isbn,
          pageCount: newBook.pageCount,
          publisher: newBook.publisher,
          publishedDate: newBook.publishedDate
      };

      // Call backend
      try {
          await addBook(book);
      } catch (e) {
          console.error(e); // Backend might be down, but local state update handles UI
      }

      onAddBooks([book]);
      onShowToast(`Libro "${book.title}" añadido correctamente`, "success");

      // Reset
      setNewBook({ unitsTotal: 1, unitsAvailable: 1, shelf: 'Recepción' });
      setCandidates([]);
  };

  const handleStartEditing = (book: Book) => {
      setEditingBook({ ...book });
      // Pre-load candidates in background
      searchBookCandidates(`${book.title} ${book.author}`).then(setCandidates);
  };

  const handleSaveEdit = async () => {
      if (!editingBook) return;
      try {
          // Llamamos al backend primero para asegurar que no hay errores (opcional, pero recomendado)
          await updateBook(editingBook);

          // En lugar de borrar y añadir, usamos la actualización directa:
          onUpdateBook(editingBook);

          onShowToast("Libro actualizado", "success");
      } catch (e) {
          onShowToast("Error al actualizar", "error");
      }
      setEditingBook(null);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser && onUpdateUser) {
      // Allow updating class, name, etc.
      const updatedUser = {
        ...editingUser,
        username: editingUser.role === UserRole.STUDENT 
           ? `${normalizeString(editingUser.firstName)}.${normalizeString(editingUser.lastName)}`
           : editingUser.username // Don't regen teacher username automatically to avoid login issues
      };
      onUpdateUser(updatedUser);
      setEditingUser(null);
    }
  };

  const handleAddPointsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(managingPointsUser && pointsAmount !== 0 && pointsReason) {
       onAddPoints(managingPointsUser.id, pointsAmount, pointsReason);
       setPointsAmount(0);
       setPointsReason('');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) setTempSettings({...tempSettings, logoUrl: e.target.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(tempSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAdminPassword.length < 4) {
      onShowToast("La contraseña debe tener al menos 4 caracteres.", "error");
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      onShowToast("Las contraseñas no coinciden.", "error");
      return;
    }
    
    // Update the current logged in user's password
    if (onUpdateUser) {
        const updatedMe = { ...currentUser, password: newAdminPassword };
        onUpdateUser(updatedMe);
        
        // Clear local inputs
        setNewAdminPassword('');
        setConfirmAdminPassword('');
        setPasswordSaved(true);
        setTimeout(() => setPasswordSaved(false), 2000);
    }
  };

  const handlePrintCards = () => window.print();

  // --- BACKUP HANDLERS ---
  const handleDownloadBackup = () => {
    const backupData: BackupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      users,
      books,
      transactions,
      reviews,
      pointHistory,
      settings
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `bibliohispa-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    onShowToast("Copia de seguridad descargada", "success");
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("⚠️ ATENCIÓN: Al restaurar una copia, se BORRARÁN todos los datos actuales y se reemplazarán por los del archivo. ¿Estás seguro?")) {
        if (backupInputRef.current) backupInputRef.current.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target?.result as string) as BackupData;
            // Basic validation
            if (!data.users || !data.books) {
                throw new Error("Formato inválido");
            }
            onRestoreBackup(data);
        } catch (error) {
            onShowToast("El archivo no es válido o está corrupto.", "error");
        }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  const availableClasses = Array.from(new Set(users.filter(u => u.role === UserRole.STUDENT).map(u => u.className))).sort();
  const availableShelves = Array.from(new Set(books.map(b => b.shelf || 'Recepción'))).sort();

  // --- Render ---

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 no-print">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 p-2 border border-slate-100 rounded-xl flex items-center justify-center bg-slate-50">
             <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-800">Panel de Administración</h1>
            <p className="text-slate-500">
               {settings.schoolName} • <span className="text-brand-600 font-bold">{isSuperAdmin ? 'SuperAdmin' : 'Profesor'}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {isSuperAdmin && (
             <Button variant={activeTab === 'teachers' ? 'primary' : 'outline'} onClick={() => setActiveTab('teachers')}>
               <Shield size={18} /> Profesores
             </Button>
          )}
          <Button variant={activeTab === 'users' ? 'primary' : 'outline'} onClick={() => setActiveTab('users')}>
            <Users size={18} /> Alumnos
          </Button>
          <Button variant={activeTab === 'books' ? 'primary' : 'outline'} onClick={() => setActiveTab('books')}>
            <BookOpen size={18} /> Libros
          </Button>
          <Button variant={activeTab === 'reviews' ? 'primary' : 'outline'} onClick={() => setActiveTab('reviews')}>
            <MessageSquare size={18} /> Opiniones
          </Button>
          <Button variant={activeTab === 'history' ? 'primary' : 'outline'} onClick={() => setActiveTab('history')}>
            <Clock size={18} /> Historial
          </Button>
           <Button variant={activeTab === 'stats' ? 'primary' : 'outline'} onClick={() => setActiveTab('stats')}>
            <BarChart3 size={18} /> Estadísticas
          </Button>
          <Button variant={activeTab === 'cards' ? 'primary' : 'outline'} onClick={() => setActiveTab('cards')}>
            <CreditCard size={18} /> Carnets
          </Button>
          
          <Button variant={activeTab === 'settings' ? 'primary' : 'outline'} onClick={() => { setActiveTab('settings'); setTempSettings(settings); }}>
            <Settings size={18} />
          </Button>
        </div>
      </header>

      {/* Teachers Tab (SuperAdmin Only) */}
      {activeTab === 'teachers' && isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold font-display text-slate-700 mb-4">Profesores Administradores</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-500 text-sm">
                                <th className="p-3">Nombre</th>
                                <th className="p-3">Usuario</th>
                                <th className="p-3">Contraseña</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {users.filter(u => u.role === UserRole.ADMIN).map(teacher => (
                                <tr key={teacher.id} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="p-3 font-medium">{teacher.firstName}</td>
                                    <td className="p-3 font-mono text-brand-600">{teacher.username}</td>
                                    <td className="p-3 font-mono text-slate-400">••••••</td>
                                    <td className="p-3 flex justify-end">
                                        <button onClick={() => onDeleteUser(teacher.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.filter(u => u.role === UserRole.ADMIN).length === 0 && (
                        <p className="p-4 text-center text-slate-400 text-sm">No hay profesores añadidos.</p>
                    )}
                </div>
             </div>
           </div>
           
           <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                 <h3 className="font-bold text-lg mb-4 text-slate-700">Nuevo Profesor</h3>
                 <form onSubmit={handleAddTeacher} className="space-y-3">
                    <input className="w-full p-2 border border-slate-200 rounded-xl bg-white text-slate-900" placeholder="Nombre (ej: Profe Juan)" value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} />
                    <input className="w-full p-2 border border-slate-200 rounded-xl bg-white text-slate-900" placeholder="Usuario (ej: profe.juan)" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} />
                    <input className="w-full p-2 border border-slate-200 rounded-xl bg-white text-slate-900" type="password" placeholder="Contraseña" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} />
                    <Button type="submit" className="w-full">
                        <UserPlus size={18}/> Crear Profesor
                    </Button>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold font-display text-slate-700">Listado de Alumnos</h2>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Buscar alumno..." 
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-slate-900"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 text-sm">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Clase</th>
                      <th className="p-3">Usuario (Login)</th>
                      <th className="p-3">Puntos</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {users
                      .filter(u => u.role === UserRole.STUDENT)
                      .filter(u => u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || u.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(user => (
                      <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-medium text-slate-700">{user.firstName} {user.lastName}</td>
                        <td className="p-3 text-slate-500">{user.className}</td>
                        <td className="p-3"><span className="font-mono text-brand-600 bg-brand-50 px-2 py-0.5 rounded text-xs">{user.username}</span></td>
                        <td className="p-3 text-fun-orange font-bold">{user.points} XP</td>
                        <td className="p-3 flex justify-end gap-2">
                          <button onClick={() => setManagingPointsUser(user)} className="text-fun-orange hover:text-orange-600 p-2 hover:bg-orange-50 rounded-lg transition-colors" title="Gestionar Puntos">
                            <Trophy size={16} />
                          </button>
                           <button onClick={() => setEditingUser(user)} className="text-brand-400 hover:text-brand-600 p-2 hover:bg-brand-50 rounded-lg transition-colors" title="Editar Clase/Datos">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => onDeleteUser(user.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
             {/* Add Single User */}
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg mb-4 text-slate-700">Añadir Alumno</h3>
                <form onSubmit={handleAddSingleUser} className="space-y-3">
                  <input className="w-full p-2 border border-slate-200 rounded-xl bg-white text-slate-900" placeholder="Nombre" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                  <input className="w-full p-2 border border-slate-200 rounded-xl bg-white text-slate-900" placeholder="Apellido" value={newUser.lastname} onChange={e => setNewUser({...newUser, lastname: e.target.value})} />
                  <input className="w-full p-2 border border-slate-200 rounded-xl bg-white text-slate-900" placeholder="Clase (ej. 3A)" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})} />
                  <Button type="submit" className="w-full">
                    <Plus size={18}/> Crear Usuario
                  </Button>
                </form>
             </div>

             {/* CSV Import */}
             <div className="bg-brand-50 p-6 rounded-3xl border border-brand-100">
               <h3 className="font-bold text-lg mb-2 text-brand-800">Importar Alumnos CSV</h3>
               <div className="mb-4">
                  <label className="block text-xs font-bold text-brand-700 uppercase mb-1">Clase para esta lista</label>
                  <input 
                    type="text"
                    className="w-full p-2 border border-brand-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                    placeholder="Ej: 5º A"
                    value={importClassName}
                    onChange={(e) => setImportClassName(e.target.value)}
                  />
               </div>

               <div className="mb-4">
                  <label className="block text-xs font-bold text-brand-700 uppercase mb-1">Codificación del Archivo</label>
                  <select 
                    value={csvEncoding}
                    onChange={(e) => setCsvEncoding(e.target.value)}
                    className="w-full p-2 border border-brand-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                  >
                    <option value="windows-1252">Excel / ANSI (Recomendado)</option>
                    <option value="UTF-8">UTF-8 (Estándar)</option>
                  </select>
               </div>

               <input 
                  type="file" 
                  accept=".csv, .txt" 
                  ref={userFileInputRef}
                  onChange={handleUserCSV}
                  className="hidden"
                  id="user-csv-upload"
               />
               <label htmlFor="user-csv-upload">
                 <div className={`w-full bg-white border-2 border-dashed border-brand-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-brand-600 ${!importClassName ? 'opacity-50' : 'hover:border-brand-500 hover:bg-brand-50'}`}>
                    <Upload size={24} className="mb-2"/>
                    <span className="font-semibold">Subir lista</span>
                 </div>
               </label>
             </div>
          </div>
        </div>
      )}

      {/* Books Tab */}
      {activeTab === 'books' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
              {/* Books Grid Preview */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                 <div className="flex justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold font-display text-slate-700 whitespace-nowrap">Catálogo ({books.length})</h2>
                    <div className="flex gap-2 w-full justify-end">
                      <select
                          className="p-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-sm max-w-[150px]"
                          value={shelfFilter}
                          onChange={(e) => setShelfFilter(e.target.value)}
                      >
                          <option value="all">Todas las estanterías</option>
                          {availableShelves.map(shelf => (
                              <option key={shelf} value={shelf}>{shelf}</option>
                          ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Buscar libro..."
                        className="pl-4 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm w-64 bg-white text-slate-900"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {books
                    .filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()))
                    .filter(b => shelfFilter === 'all' || (b.shelf || 'Recepción') === shelfFilter)
                    .map(book => (
                       <div key={book.id} className="flex gap-3 items-start p-3 border border-slate-100 rounded-xl hover:bg-slate-50 group">
                          {book.coverUrl ? (
                             <img src={book.coverUrl} className="w-16 h-24 object-cover rounded shadow-sm bg-slate-200" alt="cover"/>
                          ) : (
                             <div className="w-16 h-24 bg-gradient-to-br from-slate-200 to-slate-300 rounded shadow-sm flex items-center justify-center text-xs text-slate-500 font-bold p-1 text-center">
                                {book.title.substring(0, 10)}...
                             </div>
                          )}
                          <div className="flex-1 min-w-0">
                             <h4 className="font-bold text-slate-800 truncate text-sm" title={book.title}>{book.title}</h4>
                             <p className="text-xs text-slate-500 mb-1">{book.author}</p>
                             <div className="flex gap-2 text-xs text-slate-400 mb-2 flex-wrap">
                               <span>{book.shelf}</span>
                               <span className={book.unitsAvailable > 0 ? "text-green-600" : "text-red-500"}>{book.unitsAvailable}/{book.unitsTotal}</span>
                               {book.recommendedAge && <span className="text-purple-500 font-bold">{book.recommendedAge}</span>}
                             </div>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleStartEditing(book)} className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1">
                                    <Edit2 size={12}/> Editar
                                </button>
                                <button onClick={() => onDeleteBook(book.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                                    <Trash2 size={12}/> Eliminar
                                </button>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
           
           <div className="space-y-6">
             {/* Add Book Panel */}
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg mb-4 text-slate-700">Añadir Libro</h3>

                <form onSubmit={handleSaveBook} className="space-y-3">
                    <div className="flex gap-2 mb-2">
                        {newBook.coverUrl && (
                            <img src={newBook.coverUrl} className="w-16 h-24 object-cover rounded shadow-sm bg-slate-200" alt="Cover"/>
                        )}
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Título *</label>
                            <div className="flex gap-2">
                                <input
                                    className="w-full p-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 font-bold"
                                    value={newBook.title || ''}
                                    onChange={e => setNewBook({...newBook, title: e.target.value})}
                                    onBlur={handleBlur}
                                    placeholder="Ej: Harry Potter"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleSearchCandidates}
                                    title="Buscar datos automáticos"
                                    disabled={!newBook.title}
                                >
                                    <Wand2 size={16} />
                                </Button>
                            </div>

                            <label className="text-[10px] font-bold text-slate-400 uppercase mt-1">Autor</label>
                            <input
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                                value={newBook.author || ''}
                                onChange={e => setNewBook({...newBook, author: e.target.value})}
                                onBlur={handleBlur}
                                placeholder="Ej: J.K. Rowling"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Género</label>
                            <input
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                                value={newBook.genre || ''}
                                onChange={e => setNewBook({...newBook, genre: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Edad</label>
                            <select
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                                value={newBook.recommendedAge || ''}
                                onChange={e => setNewBook({...newBook, recommendedAge: e.target.value})}
                            >
                                <option value="">Seleccionar</option>
                                {['0-5', '6-8', '9-11', '12-14', '+15'].map(age => (
                                    <option key={age} value={age}>{age}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Unidades</label>
                            <input
                                type="number" min="1"
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                                value={newBook.unitsTotal || 1}
                                onChange={e => setNewBook({...newBook, unitsTotal: parseInt(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Estantería</label>
                            <input
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                                value={newBook.shelf || ''}
                                onChange={e => setNewBook({...newBook, shelf: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Sinopsis</label>
                        <textarea
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 h-20"
                            value={newBook.description || ''}
                            onChange={e => setNewBook({...newBook, description: e.target.value})}
                        />
                    </div>

                    {isAddingBook && (
                         <div className="bg-blue-50 text-blue-700 text-xs p-2 rounded-lg flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin"/>
                            {loadingMessage || "Buscando..."}
                         </div>
                    )}

                    <Button type="submit" size="sm" className="w-full" disabled={!newBook.title}>
                        <Check size={16} className="mr-1"/> Guardar Libro
                    </Button>
                </form>
             </div>

             {/* CSV Import */}
             <div className="bg-fun-purple/10 p-6 rounded-3xl border border-fun-purple/20">
               <h3 className="font-bold text-lg mb-2 text-fun-purple">Importar Libros CSV</h3>
               <p className="text-xs text-purple-600 mb-3">Formato: Título, Autor, Género, Unidades, Estantería, Edad Rec.</p>
               <div className="mb-4">
                  <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Codificación del Archivo</label>
                  <select 
                    value={csvEncoding}
                    onChange={(e) => setCsvEncoding(e.target.value)}
                    className="w-full p-2 border border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900"
                  >
                    <option value="windows-1252">Excel / ANSI (Recomendado)</option>
                    <option value="UTF-8">UTF-8 (Estándar)</option>
                  </select>
               </div>

               {/* PROGRESS BAR */}
               {isImportingBooks && (
                   <div className="mb-4 bg-white p-3 rounded-xl border border-purple-200">
                        <div className="flex justify-between text-xs font-bold text-purple-700 mb-1">
                             <span>{loadingMessage}</span>
                             <span>{loadingProgress}%</span>
                        </div>
                        <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden">
                             <div 
                                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${loadingProgress}%` }}
                             ></div>
                        </div>
                   </div>
               )}

               <input 
                  type="file" 
                  accept=".csv, .txt" 
                  ref={bookFileInputRef}
                  onChange={handleBookCSV}
                  className="hidden"
                  id="book-csv-upload"
               />
               <label htmlFor="book-csv-upload">
                 <div className={`w-full bg-white border-2 border-dashed border-purple-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors text-purple-600 ${isImportingBooks ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isImportingBooks ? (
                       <Loader2 size={24} className="mb-2 animate-spin"/>
                    ) : (
                       <Upload size={24} className="mb-2"/>
                    )}
                    <span className="font-semibold">{isImportingBooks ? 'Importando...' : 'Subir catálogo'}</span>
                 </div>
               </label>
             </div>
          </div>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <h2 className="text-xl font-bold font-display text-slate-700 mb-4">Opiniones de Lectores</h2>
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-100 text-slate-500 text-sm">
                   <th className="p-3">Fecha</th>
                   <th className="p-3">Libro</th>
                   <th className="p-3">Alumno</th>
                   <th className="p-3">Valoración</th>
                   <th className="p-3">Comentario</th>
                   <th className="p-3 text-right">Acciones</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {reviews.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-400">No hay opiniones todavía.</td></tr>
                 ) : (
                    reviews.map(review => {
                        const book = books.find(b => b.id === review.bookId);
                        const user = users.find(u => u.id === review.userId);
                        return (
                           <tr key={review.id} className="border-b border-slate-50 hover:bg-slate-50">
                             <td className="p-3 text-slate-500 text-xs">{new Date(review.date).toLocaleDateString()}</td>
                             <td className="p-3 font-medium text-slate-700">{book?.title || 'Libro desconocido'}</td>
                             <td className="p-3 text-slate-600">{user ? `${user.firstName} ${user.lastName}` : review.authorName}</td>
                             <td className="p-3 text-fun-orange">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</td>
                             <td className="p-3 text-slate-600 italic">"{review.comment}"</td>
                             <td className="p-3 flex justify-end">
                               <button onClick={() => onDeleteReview && onDeleteReview(review.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg">
                                 <Trash2 size={16} />
                               </button>
                             </td>
                           </tr>
                        );
                    })
                 )}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <h2 className="text-xl font-bold font-display text-slate-700 mb-4">Historial de Préstamos</h2>
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-100 text-slate-500 text-sm">
                   <th className="p-3">Fecha Préstamo</th>
                   <th className="p-3">Libro</th>
                   <th className="p-3">Alumno</th>
                   <th className="p-3">Estado</th>
                   <th className="p-3">Fecha Devolución</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {transactions.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-400">No hay historial de préstamos.</td></tr>
                 ) : (
                    [...transactions].sort((a,b) => new Date(b.dateBorrowed).getTime() - new Date(a.dateBorrowed).getTime()).map(tx => {
                        const book = books.find(b => b.id === tx.bookId);
                        const user = users.find(u => u.id === tx.userId);
                        return (
                           <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50">
                             <td className="p-3 text-slate-500 text-xs">{new Date(tx.dateBorrowed).toLocaleDateString()}</td>
                             <td className="p-3 font-medium text-slate-700">{book?.title || 'Libro desconocido'}</td>
                             <td className="p-3 text-slate-600">{user ? `${user.firstName} ${user.lastName}` : 'Usuario desconocido'}</td>
                             <td className="p-3">
                                {tx.active ? (
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">Prestado</span>
                                ) : (
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Devuelto</span>
                                )}
                             </td>
                             <td className="p-3 text-slate-500 text-xs">{tx.dateReturned ? new Date(tx.dateReturned).toLocaleDateString() : '-'}</td>
                           </tr>
                        );
                    })
                 )}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Alumnos</div>
                    <div className="text-3xl font-display font-bold text-slate-800">{users.filter(u => u.role === UserRole.STUDENT).length}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Libros en Catálogo</div>
                    <div className="text-3xl font-display font-bold text-slate-800">{books.length}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Préstamos Activos</div>
                    <div className="text-3xl font-display font-bold text-brand-500">{transactions.filter(t => t.active).length}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Opiniones</div>
                    <div className="text-3xl font-display font-bold text-fun-orange">{reviews.length}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4 text-slate-700">Lectores Top 🏆</h3>
                    <ul className="space-y-3">
                        {users
                            .filter(u => u.role === UserRole.STUDENT)
                            .sort((a, b) => b.booksRead - a.booksRead)
                            .slice(0, 5)
                            .map((u, i) => (
                                <li key={u.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{i+1}</div>
                                        <span className="font-medium text-slate-700">{u.firstName} {u.lastName}</span>
                                    </div>
                                    <div className="text-sm font-bold text-brand-600">{u.booksRead} libros</div>
                                </li>
                            ))
                        }
                    </ul>
                 </div>

                 <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4 text-slate-700">Libros Más Leídos 📖</h3>
                    <ul className="space-y-3">
                         {books
                            .sort((a, b) => b.readCount - a.readCount)
                            .slice(0, 5)
                            .map((b, i) => (
                                <li key={b.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-slate-100 text-slate-500`}>{i+1}</div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-700 truncate max-w-[200px]">{b.title}</span>
                                            <span className="text-[10px] text-slate-400">{b.author}</span>
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-brand-600">{b.readCount}</div>
                                </li>
                            ))
                        }
                    </ul>
                 </div>
            </div>
        </div>
      )}

      {/* Cards Tab */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 no-print">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold font-display text-slate-800">Generador de Carnets</h2>
                        <p className="text-slate-500">Imprime los carnets por clase o individualmente.</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
                        {/* Mode Selector */}
                        <div className="flex gap-2">
                            <div className="bg-slate-100 p-1 rounded-lg flex text-sm">
                                <button
                                    className={`px-3 py-1.5 rounded-md transition-all ${cardPrintMode === 'class' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setCardPrintMode('class')}
                                >
                                    Por Clase
                                </button>
                                <button
                                    className={`px-3 py-1.5 rounded-md transition-all ${cardPrintMode === 'individual' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setCardPrintMode('individual')}
                                >
                                    Individual
                                </button>
                            </div>

                            <div className="bg-slate-100 p-1 rounded-lg flex text-sm">
                                <button
                                    className={`px-3 py-1.5 rounded-md transition-all ${!showBackSide ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setShowBackSide(false)}
                                >
                                    Anverso
                                </button>
                                <button
                                    className={`px-3 py-1.5 rounded-md transition-all ${showBackSide ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setShowBackSide(true)}
                                >
                                    Reverso
                                </button>
                            </div>
                        </div>

                        {cardPrintMode === 'class' ? (
                            <select
                                className="p-2 border border-slate-200 rounded-xl bg-white text-slate-900"
                                value={cardClassFilter}
                                onChange={(e) => setCardClassFilter(e.target.value)}
                            >
                                <option value="all">Todas las clases</option>
                                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        ) : (
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                                <input
                                    type="text"
                                    placeholder="Buscar alumno..."
                                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-slate-900 w-64"
                                    value={cardSearchTerm}
                                    onChange={(e) => setCardSearchTerm(e.target.value)}
                                />
                            </div>
                        )}

                        <Button onClick={handlePrintCards}>
                            <Printer size={18} className="mr-2"/> Imprimir
                        </Button>
                    </div>
                </div>
            </div>

            <div id="printable-area" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 print-area">
                <style>{`
                    @media print {
                        @page { margin: 10mm; size: A4; }
                        body * { visibility: hidden; height: 0; }

                        #printable-area {
                            visibility: visible;
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: auto;
                            display: flex !important;
                            flex-wrap: wrap;
                            gap: 5mm;
                            padding: 0 !important;
                            margin: 0 !important;
                            background: white;
                        }

                        #printable-area > div {
                            visibility: visible;
                            height: auto;
                            width: auto;
                            page-break-inside: avoid;
                            break-inside: avoid;
                            margin: 0;
                            display: block;
                        }

                        .id-card-print {
                            visibility: visible;
                            position: relative !important;
                            overflow: hidden !important;
                            break-inside: avoid;
                            page-break-inside: avoid;
                            border: 1px solid #ddd !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        .id-card-print * {
                            visibility: visible;
                            height: auto;
                        }

                        .no-print { display: none !important; }
                    }
                `}</style>
                {users
                    .filter(u => u.role === UserRole.STUDENT)
                    .filter(u => {
                        if (cardPrintMode === 'class') {
                            return cardClassFilter === 'all' || u.className === cardClassFilter;
                        } else {
                            if (!cardSearchTerm) return false;
                            const search = cardSearchTerm.toLowerCase();
                            return u.firstName.toLowerCase().includes(search) ||
                                   u.lastName.toLowerCase().includes(search) ||
                                   u.username.toLowerCase().includes(search);
                        }
                    })
                    .map(user => (
                        <div key={user.id} className="flex justify-center">
                            <IDCard
                                user={user}
                                schoolName={settings.schoolName}
                                logoUrl={settings.logoUrl}
                                side={showBackSide ? 'back' : 'front'}
                            />
                        </div>
                    ))
                }
                {cardPrintMode === 'individual' && !cardSearchTerm && (
                    <div className="col-span-full text-center py-12 text-slate-400 no-print">
                        <Search size={48} className="mx-auto mb-4 opacity-20"/>
                        <p>Busca un alumno para generar su carnet.</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-bold font-display text-slate-700 mb-6">Configuración General</h2>
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre del Colegio / Biblioteca</label>
                            <input
                                className="w-full p-3 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium"
                                value={tempSettings.schoolName}
                                onChange={e => setTempSettings({...tempSettings, schoolName: e.target.value})}
                                placeholder="Ej: Biblioteca Escolar Cervantes"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Logo (URL o Archivo)</label>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center p-2">
                                    {tempSettings.logoUrl ? (
                                        <img src={tempSettings.logoUrl} className="w-full h-full object-contain" alt="Logo Preview" />
                                    ) : (
                                        <ImageIcon className="text-slate-300" size={32} />
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                                        value={tempSettings.logoUrl}
                                        onChange={e => setTempSettings({...tempSettings, logoUrl: e.target.value})}
                                        placeholder="https://..."
                                    />
                                    <div className="relative">
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        <Button type="button" variant="secondary" size="sm" className="w-full">
                                            <Upload size={14} className="mr-2"/> Subir imagen local
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <Button type="submit" disabled={settingsSaved}>
                                {settingsSaved ? <Check size={18} className="mr-2"/> : <Save size={18} className="mr-2"/>}
                                {settingsSaved ? 'Guardado' : 'Guardar Configuración'}
                            </Button>
                        </div>
                    </form>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-bold font-display text-slate-700 mb-6">Seguridad</h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                         <div className="flex gap-4 items-start bg-yellow-50 p-4 rounded-xl mb-4">
                            <Lock className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                            <div>
                                <h4 className="font-bold text-yellow-800 text-sm">Cambiar contraseña de Administrador</h4>
                                <p className="text-xs text-yellow-700">Esto cambiará la contraseña de tu usuario actual ({currentUser.username}).</p>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-900"
                                    value={newAdminPassword}
                                    onChange={e => setNewAdminPassword(e.target.value)}
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Confirmar</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-900"
                                    value={confirmAdminPassword}
                                    onChange={e => setConfirmAdminPassword(e.target.value)}
                                />
                             </div>
                         </div>
                         <Button type="submit" disabled={!newAdminPassword || passwordSaved}>
                                {passwordSaved ? 'Contraseña Actualizada' : 'Actualizar Contraseña'}
                         </Button>
                    </form>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-bold font-display text-slate-700 mb-4 flex items-center gap-2">
                        <RefreshCcw size={20} className="text-brand-500"/> Copias de Seguridad
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">Descarga una copia de toda la base de datos o restaura una anterior.</p>

                    <div className="space-y-3">
                        <Button onClick={handleDownloadBackup} variant="outline" className="w-full justify-start">
                            <Download size={18} className="mr-2"/> Descargar Copia (JSON)
                        </Button>

                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                ref={backupInputRef}
                                onChange={handleUploadBackup}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Button variant="danger" className="w-full justify-start">
                                <AlertTriangle size={18} className="mr-2"/> Restaurar Copia
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
         </div>
      )}

      {/* CANDIDATES SELECTION MODAL */}
      {showCandidates && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
               <div>
                  <h3 className="text-xl font-bold font-display text-slate-800 flex items-center gap-2">
                    <Wand2 className="text-brand-500" size={24}/>
                    Elige el libro correcto
                  </h3>
                  <p className="text-sm text-slate-500">Hemos encontrado varias coincidencias.</p>
               </div>
               <button onClick={() => { setShowCandidates(false); setIsCoverSelectionMode(false); }} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
                  <X size={20} />
               </button>
            </div>
            
            {isCoverSelectionMode ? (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <p className="text-sm text-slate-500 mb-3">Selecciona una imagen para usarla como portada:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {candidates.map((cand, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSelectCandidate(cand)}
                                className="aspect-[2/3] bg-slate-100 rounded-lg cursor-pointer hover:ring-4 hover:ring-brand-200 transition-all overflow-hidden relative group"
                            >
                                {cand.coverUrl ? (
                                    <img src={cand.coverUrl} className="w-full h-full object-cover" alt={cand.title} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 p-2 text-center">Sin imagen</div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {candidates.map((cand, idx) => (
                        <div
                            key={idx}
                            className="flex gap-4 p-3 border border-slate-200 rounded-xl hover:bg-brand-50 cursor-pointer transition-colors group"
                            onClick={() => handleSelectCandidate(cand)}
                        >
                            <div className="w-16 h-24 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                                {cand.coverUrl ? (
                                    <img src={cand.coverUrl} className="w-full h-full object-cover" alt="cover"/>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 text-center p-1">Sin imagen</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 text-sm">{cand.title}</h4>
                                <p className="text-xs text-slate-600">{cand.author}</p>
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{cand.description}</p>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{cand.genre}</span>
                                    {cand.publishedDate && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{cand.publishedDate.split('-')[0]}</span>}
                                </div>
                            </div>
                            <div className="flex items-center">
                                <ArrowRight size={20} className="text-slate-300 group-hover:text-brand-500" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold font-display text-slate-800">Editar Usuario</h3>
                    <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre</label>
                        <input className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-900" value={editingUser.firstName} onChange={e => setEditingUser({...editingUser, firstName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Apellido</label>
                        <input className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-900" value={editingUser.lastName} onChange={e => setEditingUser({...editingUser, lastName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Clase</label>
                        <input className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-900" value={editingUser.className} onChange={e => setEditingUser({...editingUser, className: e.target.value})} />
                    </div>
                    {editingUser.role === UserRole.STUDENT && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Usuario (Auto-generado)</label>
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 text-sm font-mono">
                                {normalizeString(editingUser.firstName)}.{normalizeString(editingUser.lastName)}
                            </div>
                        </div>
                    )}
                    <div className="pt-2 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
                        <Button type="submit">Guardar</Button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Manage Points Modal */}
      {managingPointsUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-bold font-display text-slate-800">Gestión de Puntos</h3>
                        <p className="text-sm text-slate-500">{managingPointsUser.firstName} {managingPointsUser.lastName} • <span className="font-bold text-fun-orange">{managingPointsUser.points} XP</span></p>
                    </div>
                    <button onClick={() => setManagingPointsUser(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-100">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">Añadir / Restar Puntos</h4>
                    <form onSubmit={handleAddPointsSubmit} className="flex gap-2 items-end">
                        <div className="flex-1">
                             <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Motivo</label>
                             <input className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900" placeholder="Ej: Ayudar en biblioteca" value={pointsReason} onChange={e => setPointsReason(e.target.value)} />
                        </div>
                        <div className="w-24">
                             <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cantidad</label>
                             <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900" placeholder="+10 / -5" value={pointsAmount || ''} onChange={e => setPointsAmount(parseInt(e.target.value))} />
                        </div>
                        <Button type="submit" disabled={!pointsReason || !pointsAmount}>
                            <Plus size={18}/>
                        </Button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">Historial</h4>
                    {pointHistory.filter(h => h.userId === managingPointsUser.id).length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No hay historial de puntos.</p>
                    ) : (
                        <div className="space-y-2">
                            {pointHistory.filter(h => h.userId === managingPointsUser.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(h => (
                                <div key={h.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-white text-sm">
                                    <div>
                                        <div className="font-bold text-slate-700">{h.reason}</div>
                                        <div className="text-xs text-slate-400">{new Date(h.date).toLocaleDateString()}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${h.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {h.amount > 0 ? '+' : ''}{h.amount}
                                        </span>
                                        <button onClick={() => onDeletePointEntry(h.id)} className="text-slate-300 hover:text-red-500">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold font-display text-slate-800">Editar Libro</h3>
                    <button onClick={() => { setEditingBook(null); setShowCandidates(false); setIsCoverSelectionMode(false); }} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>

                <div className="space-y-3">
                    <div className="flex gap-4">
                        {editingBook.coverUrl && <img src={editingBook.coverUrl} className="w-20 h-32 object-cover rounded bg-slate-200"/>}
                        <div className="flex-1 space-y-2">
                            <input className="w-full p-2 border rounded" value={editingBook.title} onChange={e => setEditingBook({...editingBook, title: e.target.value})} placeholder="Título" />
                            <input className="w-full p-2 border rounded" value={editingBook.author} onChange={e => setEditingBook({...editingBook, author: e.target.value})} placeholder="Autor" />
                            <Button size="sm" variant="outline" onClick={() => { setIsCoverSelectionMode(true); setShowCandidates(true); }}><Wand2 size={14} className="mr-2"/> Buscar Portada Alternativa</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <input className="p-2 border rounded" value={editingBook.genre} onChange={e => setEditingBook({...editingBook, genre: e.target.value})} placeholder="Género" />
                        <select
                            className="p-2 border rounded bg-white text-slate-900"
                            value={editingBook.recommendedAge || ''}
                            onChange={e => setEditingBook({...editingBook, recommendedAge: e.target.value})}
                        >
                            <option value="">Seleccionar Edad</option>
                            {['0-5', '6-8', '9-11', '12-14', '+15'].map(age => (
                                <option key={age} value={age}>{age}</option>
                            ))}
                        </select>
                        <input type="number" className="p-2 border rounded" value={editingBook.unitsTotal} onChange={e => setEditingBook({...editingBook, unitsTotal: parseInt(e.target.value)})} placeholder="Unidades" />
                        <input className="p-2 border rounded" value={editingBook.shelf} onChange={e => setEditingBook({...editingBook, shelf: e.target.value})} placeholder="Estantería" />
                    </div>

                    <textarea className="w-full p-2 border rounded h-24 text-sm" value={editingBook.description || ''} onChange={e => setEditingBook({...editingBook, description: e.target.value})} placeholder="Sinopsis" />

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => { setEditingBook(null); setShowCandidates(false); setIsCoverSelectionMode(false); }}>Cancelar</Button>
                        <Button onClick={handleSaveEdit}><Save size={16} className="mr-2"/> Guardar Cambios</Button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
