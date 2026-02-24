
import * as React from 'react';
import { User, Book, RawUserImport, RawBookImport, UserRole, Review, AppSettings, PointHistory, Transaction, BackupData } from '../types';
import { normalizeString } from '../services/storageService';
import { compareClassNames, compareStudents, proxyCoverUrl } from '../services/utils';
import { searchBookCover, determineBookAge, searchBookMetadata, searchBookMetadataBatch, searchBookCandidates, updateBook, deleteBook, addBook } from '../services/bookService';
import { syncStudents } from '../services/userService';
import { generateStudentLoanReport } from '../services/reportService';
import { Button } from './Button';
import { IDCard } from './IDCard';
import { ToastType } from './Toast';
import { Upload, Plus, Trash2, Users, BookOpen, BarChart3, Search, Loader2, Edit2, X, Save, MessageSquare, Settings, Check, Image as ImageIcon, Lock, Key, CreditCard, Printer, Trophy, History, RefreshCcw, UserPlus, Shield, Clock, Download, AlertTriangle, ArrowRight, Wand2, FileText, ChevronDown, ChevronUp, Menu, LogOut, Sun, Moon, Monitor } from 'lucide-react';

interface AdminViewProps {
  currentUser: User;
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
  onLogout: () => void;
  theme?: 'dark' | 'light' | 'system';
  setTheme?: (t: 'dark' | 'light' | 'system') => void;
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
  onRestoreBackup,
  onLogout,
  theme,
  setTheme
}) => {
  const [activeTab, setActiveTab] = React.useState<'users' | 'books' | 'reviews' | 'stats' | 'settings' | 'cards' | 'teachers' | 'history' | 'menu'>('users');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [viewScope, setViewScope] = React.useState<'global' | 'class'>('global');
  const [historySearchTerm, setHistorySearchTerm] = React.useState('');
  
  // Single Entry States
  const [newUser, setNewUser] = React.useState({ name: '', lastname: '', className: '' });

  // Add Book State
  const [newBook, setNewBook] = React.useState<Partial<Book>>({ unitsTotal: 1, unitsAvailable: 1, shelf: 'Recepción' });
  const [candidates, setCandidates] = React.useState<Partial<Book>[]>([]);
  const [showCandidates, setShowCandidates] = React.useState(false);
  const [isCoverSelectionMode, setIsCoverSelectionMode] = React.useState(false);
  const [coverSearchQuery, setCoverSearchQuery] = React.useState('');
  const [isSearchingCovers, setIsSearchingCovers] = React.useState(false);

  // Edit Book State
  const [editingBook, setEditingBook] = React.useState<Book | null>(null);

  const [newTeacher, setNewTeacher] = React.useState({ name: '', username: '', password: '' });
  
  // Import Config State
  const [importClassName, setImportClassName] = React.useState('');
  const [csvEncoding, setCsvEncoding] = React.useState<string>('windows-1252');
  
  // Edit User State
  const [editingUser, setEditingUser] = React.useState<User | null>(null);

  // Report State
  const [reportUser, setReportUser] = React.useState<User | null>(null);

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
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMobileActionsOpen(false);
  }, [activeTab]);

  const MobileActionsToggle = ({ label }: { label: string }) => (
      <button
          onClick={() => setIsMobileActionsOpen(!isMobileActionsOpen)}
          className="lg:hidden w-full glass-panel p-4 rounded-3xl shadow-sm flex justify-between items-center text-themed font-bold mb-4 flex-none"
      >
          <span>{label}</span>
          {isMobileActionsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
  );

  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  // NEW: Check if teacher (Admin) to filter visibility
  const isTeacher = currentUser.role === UserRole.ADMIN;
  const isTechnical = isSuperAdmin || !!currentUser.isTechnical;

  // Filtered lists based on permissions
  const visibleUsers = React.useMemo(() => {
     let result: User[] = [];
     if (isTechnical && viewScope === 'global') {
        result = users;
     } else if (isTeacher || (isTechnical && viewScope === 'class')) {
        // Teachers only see students in their class (if assigned)
        if (currentUser.classId) {
             result = users.filter(u => u.role === UserRole.STUDENT && u.classId == currentUser.classId);
        } else {
            if (currentUser.className && currentUser.className !== 'PROFESORADO' && currentUser.className !== 'STAFF') {
                 result = users.filter(u => u.role === UserRole.STUDENT && u.className === currentUser.className);
            } else {
                result = users; // Default to all if no specific class link found
            }
        }
     }
     return [...result].sort(compareStudents);
  }, [users, currentUser, isSuperAdmin, isTeacher, isTechnical, viewScope]);

  const visibleReviews = React.useMemo(() => {
      if (isTechnical && viewScope === 'global') return reviews;
      const visibleUserIds = new Set(visibleUsers.map(u => u.id));
      return reviews.filter(r => visibleUserIds.has(r.userId));
  }, [reviews, visibleUsers, isTechnical, viewScope]);

  const visibleTransactions = React.useMemo(() => {
      if (isTechnical && viewScope === 'global') return transactions;
      const visibleUserIds = new Set(visibleUsers.map(u => u.id));
      return transactions.filter(t => visibleUserIds.has(t.userId));
  }, [transactions, visibleUsers, isTechnical, viewScope]);


  // References for file inputs
  const userFileInputRef = React.useRef<HTMLInputElement>(null);
  const bookFileInputRef = React.useRef<HTMLInputElement>(null);
  const backupInputRef = React.useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleSyncStudents = async () => {
    setIsSyncing(true);
    try {
        const result = await syncStudents();
        if (result.success) {
            onShowToast(`✅ Sincronización completada. Actualizados: ${result.updated}, Nuevos: ${result.created}`, "success");
            // Reload page or re-fetch users ideally, but full reload ensures state sync
            setTimeout(() => window.location.reload(), 1500);
        } else {
            onShowToast("❌ Error al sincronizar: " + (result.error || 'Desconocido'), "error");
        }
    } catch (error) {
        onShowToast("❌ Fallo de conexión con el sistema central.", "error");
    } finally {
        setIsSyncing(false);
    }
  };

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

      // Parse CSV rows first
      const csvRows: { title: string; author: string; genre: string; units: number; shelf: string; ageFromCsv: string }[] = [];
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2 && parts[0]) {
          csvRows.push({
            title: parts[0],
            author: parts[1] || '',
            genre: parts[2] || 'General',
            units: parseInt(parts[3]) || 1,
            shelf: parts[4] || 'Recepción',
            ageFromCsv: parts[5] || ''
          });
        }
      }

      if (csvRows.length === 0) {
        setIsImportingBooks(false);
        onShowToast("No se encontraron libros en el archivo.", "error");
        return;
      }

      // Batch: one Gemini call for all books (ISBN + age), then covers one by one
      const batchInput = csvRows.map(r => ({ title: r.title, author: r.author }));
      const metadataResults = await searchBookMetadataBatch(batchInput, (current, total, title) => {
        setLoadingProgress(Math.round((current / total) * 100));
        setLoadingMessage(current === 0 ? title : `Buscando portadas (${current}/${total}): "${title}"`);
      });

      const parsedBooks: Book[] = csvRows.map((row, i) => {
        const meta = metadataResults[i] || {};
        return {
          id: `book-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          title: row.title,
          author: (!row.author || row.author === 'Desconocido') ? (meta.author || 'Desconocido') : row.author,
          genre: (!row.genre || row.genre === 'General') ? (meta.genre || 'General') : row.genre,
          unitsTotal: row.units,
          unitsAvailable: row.units,
          shelf: row.shelf,
          coverUrl: meta.coverUrl || undefined,
          readCount: 0,
          recommendedAge: row.ageFromCsv || meta.recommendedAge || '6-8',
          description: meta.description,
          isbn: meta.isbn,
          pageCount: meta.pageCount,
          publisher: meta.publisher,
          publishedDate: meta.publishedDate
        };
      });

      setIsImportingBooks(false);
      setLoadingProgress(100);
      setLoadingMessage("¡Completado!");
      onAddBooks(parsedBooks);
      onShowToast(`Se han importado ${parsedBooks.length} libros correctamente.`, "success");
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

      // Call backend via App.tsx handler
      onAddBooks([book]);
      onShowToast(`Libro "${book.title}" añadido correctamente`, "success");

      // Reset
      setNewBook({ unitsTotal: 1, unitsAvailable: 1, shelf: 'Recepción' });
      setCandidates([]);
  };

  const handleStartEditing = (book: Book) => {
      setEditingBook({ ...book });
      setCandidates([]);
  };

  const handleSearchAlternativeCovers = async (customQuery?: string) => {
      if (!editingBook) return;
      const query = customQuery || `${editingBook.title} ${editingBook.author}`;
      setIsCoverSelectionMode(true);
      setShowCandidates(true);
      setCandidates([]);
      setIsSearchingCovers(true);
      if (!customQuery) setCoverSearchQuery(query);
      try {
          const results = await searchBookCandidates(query);
          setCandidates(results);
      } catch {
          onShowToast("Error buscando portadas.", "error");
      } finally {
          setIsSearchingCovers(false);
      }
  };

  const handleSaveEdit = async () => {
      if (!editingBook) return;

      // En lugar de borrar y añadir, usamos la actualización directa (App.tsx gestiona la API):
      onUpdateBook(editingBook);
      // onShowToast se llama en App.tsx ahora para confirmar éxito/error de API,
      // pero aquí podemos cerrar el modal inmediatamente.

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

  const availableClasses = Array.from(new Set(visibleUsers.filter(u => u.role === UserRole.STUDENT).map(u => u.className))).sort(compareClassNames);
  const availableShelves = Array.from(new Set(books.map(b => b.shelf || 'Recepción'))).sort();

  const LIBRARY_SUBCATEGORIES = [
    "Narrativa",
    "Poesía",
    "Teatro",
    "Cómic",
    "Álbum Ilustrado",
    "Conocimiento",
    "Biografía",
    "Idiomas",
    "Otros"
  ];

  // --- Render ---

  return (
    <div className="h-[100dvh] flex flex-col w-full max-w-7xl mx-auto overflow-hidden">

      {/* HEADER - Fixed */}
      <div className="flex-none p-4 md:p-6 pb-0 z-30">
          <header className="glass-header flex flex-col gap-3 p-4 md:px-5 md:py-4 rounded-3xl shadow-glass-sm no-print mb-3">
            {/* Top row: Brand + Info + Theme */}
            <div className="flex items-center gap-4 w-full">
              {/* Prisma link (four-squares icon) */}
              <a href="https://prisma.bibliohispa.es/" className="flex-none text-themed-muted hover:text-brand-500 transition-colors duration-200 press-effect" title="Volver a Prisma">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" fill="#3b82f6" stroke="#3b82f6" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </a>

              {/* Logo - larger and integrated */}
              <div className="flex-none w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm" style={{ filter: 'var(--header-logo-filter, none)' }} />
              </div>

              {/* Title + Role */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg md:text-xl font-display font-bold text-themed leading-tight truncate">Panel de Administración</h1>
                <p className="text-themed-muted text-xs truncate">
                  {settings.schoolName} • <span className="text-brand-500 font-bold">
                      {isSuperAdmin ? 'SuperAdmin' : 'Profesor'}
                      {!isSuperAdmin && currentUser.className && currentUser.className !== 'PROFESORADO' && ` - ${currentUser.className}`}
                  </span>
                </p>
              </div>

              {/* Right side: scope toggle + theme */}
              <div className="flex-none flex items-center gap-2">
                {isTechnical && (
                    <div className="hidden md:flex bg-[var(--surface-raised)] backdrop-blur-sm p-0.5 rounded-xl border border-[var(--glass-border)]">
                        <button
                            onClick={() => setViewScope('global')}
                            className={`px-2.5 py-1 rounded-lg text-xs transition-all duration-200 ${viewScope === 'global' ? 'bg-[var(--tab-active-bg)] shadow-glass-sm font-bold text-brand-400' : 'text-themed-muted hover:text-themed-secondary'}`}
                        >
                            Global
                        </button>
                        <button
                            onClick={() => setViewScope('class')}
                            className={`px-2.5 py-1 rounded-lg text-xs transition-all duration-200 ${viewScope === 'class' ? 'bg-[var(--tab-active-bg)] shadow-glass-sm font-bold text-brand-400' : 'text-themed-muted hover:text-themed-secondary'}`}
                        >
                            Mi Clase
                        </button>
                    </div>
                )}
                {setTheme && (
                  <div className="flex theme-toggle-group rounded-lg p-0.5">
                    <button onClick={() => setTheme('light')} className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'light' ? 'theme-toggle-active' : 'text-themed-muted hover:text-themed-secondary'}`} title="Modo claro">
                      <Sun size={14} />
                    </button>
                    <button onClick={() => setTheme('system')} className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'system' ? 'theme-toggle-active' : 'text-themed-muted hover:text-themed-secondary'}`} title="Automático">
                      <Monitor size={14} />
                    </button>
                    <button onClick={() => setTheme('dark')} className={`flex justify-center p-1.5 rounded-md text-sm transition-colors ${theme === 'dark' ? 'theme-toggle-active' : 'text-themed-muted hover:text-themed-secondary'}`} title="Modo oscuro">
                      <Moon size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom row: Navigation tabs (desktop only) */}
            <div className="hidden md:flex gap-1.5 overflow-x-auto no-scrollbar mask-gradient-right flex-wrap -mb-1">
              {isSuperAdmin && (
                <button onClick={() => setActiveTab('teachers')} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'teachers' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                  <Shield size={15} /> Profesores
                </button>
              )}
              <button onClick={() => setActiveTab('users')} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'users' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                <Users size={15} /> Alumnos
              </button>
              <button onClick={() => setActiveTab('books')} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'books' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                <BookOpen size={15} /> Libros
              </button>
              <button onClick={() => setActiveTab('reviews')} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'reviews' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                <MessageSquare size={15} /> Opiniones
              </button>
              <button onClick={() => setActiveTab('history')} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'history' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                <Clock size={15} /> Historial
              </button>
              <button onClick={() => setActiveTab('stats')} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'stats' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                <BarChart3 size={15} /> Estadísticas
              </button>
              <button onClick={() => setActiveTab('cards')} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'cards' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                <CreditCard size={15} /> Carnets
              </button>

              {isTechnical && viewScope === 'global' && (
              <button onClick={() => { setActiveTab('settings'); setTempSettings(settings); }} className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 press-effect ${activeTab === 'settings' ? 'bg-brand-500 text-white shadow-brand' : 'text-themed-muted hover:text-themed-secondary hover:bg-[var(--tab-inactive-hover)]'}`}>
                <Settings size={15} />
              </button>
              )}
            </div>
          </header>
      </div>

      {/* CONTENT AREA - Scrollable except for Books tab special handling */}
      <div className="flex-1 overflow-hidden relative w-full px-4 md:px-6 pb-20 md:pb-6">

        {/* USERS TAB - Special Layout (Fixed Headers/Split Scroll) */}
        {activeTab === 'users' && (
           <div className="h-full flex flex-col lg:grid lg:grid-cols-3 gap-6">
              {/* Left/Bottom: List */}
              <div className="flex-1 lg:col-span-2 h-full flex flex-col order-2 lg:order-1 min-h-0">
                  <div className="glass-panel p-6 rounded-3xl shadow-glass-sm flex flex-col h-full overflow-hidden">
                      {/* Fixed Header */}
                      <div className="flex-none flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold font-display text-themed">Listado de Alumnos</h2>
                        <div className="relative group">
                          <input
                            type="text"
                            placeholder="Buscar alumno..."
                            className="pl-9 pr-4 py-2.5 glass-input rounded-xl focus:outline-none text-sm text-themed"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                          <Search size={16} className="absolute left-3 top-3 text-themed-muted group-focus-within:text-brand-500 transition-colors"/>
                        </div>
                      </div>

                      {/* Scrollable List */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 lg:pb-0">
                          {/* Desktop Table */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-[var(--glass-border)] text-themed-muted text-sm">
                                  <th className="p-3">Nombre</th>
                                  <th className="p-3">Clase</th>
                                  <th className="p-3">Usuario (Login)</th>
                                  <th className="p-3">Puntos</th>
                                  <th className="p-3 text-right">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="text-sm">
                                {visibleUsers
                                  .filter(u => u.role === UserRole.STUDENT)
                                  .filter(u => u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || u.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
                                  .map(user => (
                                  <tr key={user.id} className="border-b border-[var(--divider)] hover:bg-brand-500/10 transition-colors duration-150">
                                    <td className="p-3 font-medium text-themed">{user.firstName} {user.lastName}</td>
                                    <td className="p-3 text-themed-muted">{user.className}</td>
                                    <td className="p-3"><span className="font-mono text-brand-400 bg-brand-500/15 px-2 py-0.5 rounded text-xs">{user.username}</span></td>
                                    <td className="p-3 text-fun-orange font-bold">{user.points} XP</td>
                                    <td className="p-3 flex justify-end gap-2">
                                      <button onClick={() => setReportUser(user)} className="text-blue-500 hover:text-blue-400 p-2 hover:bg-blue-500/10 rounded-lg transition-colors" title="Informe PDF">
                                        <FileText size={16} />
                                      </button>
                                      <button onClick={() => setManagingPointsUser(user)} className="text-fun-orange hover:text-orange-400 p-2 hover:bg-orange-500/10 rounded-lg transition-colors" title="Gestionar Puntos">
                                        <Trophy size={16} />
                                      </button>
                                      <button onClick={() => setEditingUser(user)} className="text-brand-400 hover:text-brand-400 p-2 hover:bg-brand-500/10 rounded-lg transition-colors" title="Editar Clase/Datos">
                                        <Edit2 size={16} />
                                      </button>
                                      <button onClick={() => onDeleteUser(user.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar">
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Card View */}
                          <div className="md:hidden space-y-4">
                            {visibleUsers
                                  .filter(u => u.role === UserRole.STUDENT)
                                  .filter(u => u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || u.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
                                  .map(user => (
                                  <div key={user.id} className="glass-card p-4 rounded-xl flex flex-col gap-2">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <h4 className="font-bold text-themed">{user.firstName} {user.lastName}</h4>
                                              <p className="text-xs text-themed-muted">{user.className} • <span className="font-mono text-brand-400">{user.username}</span></p>
                                          </div>
                                          <span className="bg-fun-orange/10 text-fun-orange px-2 py-1 rounded-lg text-xs font-bold">{user.points} XP</span>
                                      </div>
                                      <div className="flex justify-end gap-2 border-t border-[var(--glass-border)] pt-2 mt-1">
                                          <button onClick={() => setReportUser(user)} className="p-2 text-blue-500 bg-blue-50 rounded-lg"><FileText size={16}/></button>
                                          <button onClick={() => setManagingPointsUser(user)} className="p-2 text-fun-orange bg-orange-500/15 rounded-lg"><Trophy size={16}/></button>
                                          <button onClick={() => setEditingUser(user)} className="p-2 text-brand-500 bg-brand-500/15 rounded-lg"><Edit2 size={16}/></button>
                                          <button onClick={() => onDeleteUser(user.id)} className="p-2 text-red-500 bg-red-500/15 rounded-lg"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                            ))}
                          </div>
                      </div>
                  </div>
              </div>

              {/* Right/Top: Add Panel */}
              <div className="order-1 lg:order-2 flex-none lg:h-full lg:overflow-y-auto no-scrollbar">
                <MobileActionsToggle label="Añadir / Importar Alumnos" />
                <div className={`space-y-6 ${isMobileActionsOpen ? 'block' : 'hidden'} lg:block`}>
                    {/* Add Single User */}
                    <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                        <h3 className="font-bold text-lg mb-4 text-themed">Añadir Alumno</h3>
                        <form onSubmit={handleAddSingleUser} className="space-y-3">
                          <input className="w-full p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed" placeholder="Nombre" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                          <input className="w-full p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed" placeholder="Apellido" value={newUser.lastname} onChange={e => setNewUser({...newUser, lastname: e.target.value})} />
                          <input className="w-full p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed" placeholder="Clase (ej. 3A)" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})} />
                          <Button type="submit" className="w-full">
                            <Plus size={18}/> Crear Usuario
                          </Button>
                        </form>
                    </div>

                    {/* SYNC PANEL */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-3xl border border-indigo-100 shadow-sm">
                      <h3 className="font-bold text-lg mb-2 text-indigo-300 flex items-center gap-2">
                        <RefreshCcw size={20} className={isSyncing ? "animate-spin" : ""} />
                        Sincronización Central
                      </h3>
                      <p className="text-sm text-indigo-300 mb-4">
                          Actualiza el listado de alumnos y profesores directamente desde la plataforma PrismaEdu del colegio.
                      </p>
                      <Button
                        onClick={handleSyncStudents}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                        disabled={isSyncing}
                      >
                        {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar Usuarios y Clases'}
                      </Button>
                    </div>

                    {/* CSV Import */}
                    <div className="bg-brand-500/15 p-6 rounded-3xl border border-brand-500/20">
                      <h3 className="font-bold text-lg mb-2 text-brand-300">Importar Alumnos CSV (Manual)</h3>
                      <div className="mb-4">
                          <label className="block text-xs font-bold text-brand-300 uppercase mb-1">Clase para esta lista</label>
                          <input
                            type="text"
                            className="w-full p-2 border border-brand-500/20 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-[var(--input-bg)] text-themed"
                            placeholder="Ej: 5º A"
                            value={importClassName}
                            onChange={(e) => setImportClassName(e.target.value)}
                          />
                      </div>

                      <div className="mb-4">
                          <label className="block text-xs font-bold text-brand-300 uppercase mb-1">Codificación del Archivo</label>
                          <select
                            value={csvEncoding}
                            onChange={(e) => setCsvEncoding(e.target.value)}
                            className="w-full p-2 border border-brand-500/20 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-[var(--input-bg)] text-themed"
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
                        <div className={`w-full bg-[var(--input-bg)] border-2 border-dashed border-brand-500/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-brand-400 ${!importClassName ? 'opacity-50' : 'hover:border-brand-500 hover:bg-brand-500/10'}`}>
                            <Upload size={24} className="mb-2"/>
                                <span className="font-semibold">Subir lista</span>
                            </div>
                          </label>
                        </div>
                    </div>
                  </div>
           </div>
        )}

        {/* NON-BOOKS & NON-USERS TABS (Standard Scrollable Layout) */}
        {activeTab !== 'books' && activeTab !== 'users' && (
           <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pb-24">

              {/* Teachers Tab (SuperAdmin Only) */}
              {activeTab === 'teachers' && isSuperAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
                    <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                        <h2 className="text-xl font-bold font-display text-themed mb-4">Profesores Administradores</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[var(--glass-border)] text-themed-muted text-sm">
                                        <th className="p-3">Nombre</th>
                                        <th className="p-3">Usuario</th>
                                        <th className="p-3">Contraseña</th>
                                        <th className="p-3">Rol Técnico</th>
                                        <th className="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {users.filter(u => u.role === UserRole.ADMIN).map(teacher => (
                                        <tr key={teacher.id} className="border-b border-[var(--divider)] hover:bg-[var(--surface-raised)]">
                                            <td className="p-3 font-medium">{teacher.firstName}</td>
                                            <td className="p-3 font-mono text-brand-400">{teacher.username}</td>
                                            <td className="p-3 font-mono text-themed-muted">••••••</td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => onUpdateUser && onUpdateUser({ ...teacher, isTechnical: !teacher.isTechnical })}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${teacher.isTechnical ? 'bg-indigo-500/15 text-indigo-300' : 'bg-[var(--surface-raised)] text-themed-muted'}`}
                                                    title="Click para cambiar rol"
                                                >
                                                    {teacher.isTechnical ? 'Técnico' : 'Estándar'}
                                                </button>
                                            </td>
                                            <td className="p-3 flex justify-end">
                                                <button onClick={() => onDeleteUser(teacher.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-500/10 rounded-lg">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {users.filter(u => u.role === UserRole.ADMIN).length === 0 && (
                                <p className="p-4 text-center text-themed-muted text-sm">No hay profesores añadidos.</p>
                            )}
                        </div>
                    </div>
                  </div>

                  <div className="order-1 lg:order-2">
                      <MobileActionsToggle label="Añadir Profesor" />
                      <div className={`space-y-6 ${isMobileActionsOpen ? 'block' : 'hidden'} lg:block`}>
                          <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                            <h3 className="font-bold text-lg mb-4 text-themed">Nuevo Profesor</h3>
                            <form onSubmit={handleAddTeacher} className="space-y-3">
                                <input className="w-full p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed" placeholder="Nombre (ej: Profe Juan)" value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} />
                                <input className="w-full p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed" placeholder="Usuario (ej: profe.juan)" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} />
                                <input className="w-full p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed" type="password" placeholder="Contraseña" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} />
                                <Button type="submit" className="w-full">
                                    <UserPlus size={18}/> Crear Profesor
                                </Button>
                            </form>
                          </div>
                      </div>
                  </div>
                </div>
              )}

              {/* Reviews Tab */}
              {activeTab === 'reviews' && (
                <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                  <h2 className="text-xl font-bold font-display text-themed mb-4">Opiniones de Lectores</h2>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--glass-border)] text-themed-muted text-sm">
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Libro</th>
                          <th className="p-3">Alumno</th>
                          <th className="p-3">Valoración</th>
                          <th className="p-3">Comentario</th>
                          <th className="p-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {visibleReviews.length === 0 ? (
                            <tr><td colSpan={6} className="p-4 text-center text-themed-muted">No hay opiniones todavía.</td></tr>
                        ) : (
                            visibleReviews.map(review => {
                                const book = books.find(b => b.id === review.bookId);
                                const user = users.find(u => u.id === review.userId);
                                return (
                                  <tr key={review.id} className="border-b border-[var(--divider)] hover:bg-[var(--surface-raised)]">
                                    <td className="p-3 text-themed-muted text-xs">{new Date(review.date).toLocaleDateString()}</td>
                                    <td className="p-3 font-medium text-themed">{book?.title || 'Libro desconocido'}</td>
                                    <td className="p-3 text-themed-secondary">{user ? `${user.firstName} ${user.lastName}` : review.authorName}</td>
                                    <td className="p-3 text-fun-orange">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</td>
                                    <td className="p-3 text-themed-secondary italic">"{review.comment}"</td>
                                    <td className="p-3 flex justify-end">
                                      <button onClick={() => onDeleteReview && onDeleteReview(review.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-500/10 rounded-lg">
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

                  {/* Mobile Reviews */}
                  <div className="md:hidden space-y-4">
                      {visibleReviews.map(review => {
                          const book = books.find(b => b.id === review.bookId);
                          const user = users.find(u => u.id === review.userId);
                          return (
                              <div key={review.id} className="glass-card p-4 rounded-xl flex flex-col gap-2">
                                  <div className="flex justify-between items-start">
                                      <h4 className="font-bold text-themed text-sm">{book?.title}</h4>
                                      <div className="text-fun-orange text-xs">{'★'.repeat(review.rating)}</div>
                                  </div>
                                  <p className="text-xs text-themed-muted italic">"{review.comment}"</p>
                                  <div className="flex justify-between items-center text-xs text-themed-muted border-t border-[var(--glass-border)] pt-2">
                                      <span>{user ? `${user.firstName} ${user.lastName}` : review.authorName}</span>
                                      <div className="flex gap-2 items-center">
                                          <span>{new Date(review.date).toLocaleDateString()}</span>
                                          <button onClick={() => onDeleteReview && onDeleteReview(review.id)} className="text-red-400"><Trash2 size={14}/></button>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                  <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                      <h2 className="text-xl font-bold font-display text-themed">Historial de Préstamos</h2>
                      <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                          <div className="relative w-full md:w-64">
                              <input
                                type="text"
                                placeholder="Buscar por libro o alumno..."
                                className="pl-9 pr-4 py-2 border border-[var(--glass-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-[var(--input-bg)] text-themed w-full"
                                value={historySearchTerm}
                                onChange={(e) => setHistorySearchTerm(e.target.value)}
                              />
                              <Search size={16} className="absolute left-3 top-2.5 text-themed-muted"/>
                          </div>
                      </div>
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--glass-border)] text-themed-muted text-sm">
                          <th className="p-3">Fecha Préstamo</th>
                          <th className="p-3">Libro</th>
                          <th className="p-3">Alumno</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Fecha Devolución</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {visibleTransactions.length === 0 ? (
                            <tr><td colSpan={5} className="p-4 text-center text-themed-muted">No hay historial de préstamos.</td></tr>
                        ) : (
                            [...visibleTransactions]
                            .filter(tx => {
                                if (!historySearchTerm) return true;
                                const term = historySearchTerm.toLowerCase();
                                const book = books.find(b => b.id === tx.bookId);
                                const user = users.find(u => u.id === tx.userId);
                                const bookTitle = book?.title.toLowerCase() || '';
                                const userName = user ? `${user.firstName} ${user.lastName}`.toLowerCase() : '';
                                return bookTitle.includes(term) || userName.includes(term);
                            })
                            .sort((a,b) => new Date(b.dateBorrowed).getTime() - new Date(a.dateBorrowed).getTime()).map(tx => {
                                const book = books.find(b => b.id === tx.bookId);
                                const user = users.find(u => u.id === tx.userId);
                                return (
                                  <tr key={tx.id} className="border-b border-[var(--divider)] hover:bg-[var(--surface-raised)]">
                                    <td className="p-3 text-themed-muted text-xs">{new Date(tx.dateBorrowed).toLocaleDateString()}</td>
                                    <td className="p-3 font-medium text-themed">{book?.title || 'Libro desconocido'}</td>
                                    <td className="p-3 text-themed-secondary">{user ? `${user.firstName} ${user.lastName}` : 'Usuario desconocido'}</td>
                                    <td className="p-3">
                                        {tx.active ? (
                                            <span className="bg-yellow-500/15 text-yellow-400 px-2 py-1 rounded text-xs font-bold">Prestado</span>
                                        ) : (
                                            <span className="bg-green-500/15 text-green-400 px-2 py-1 rounded text-xs font-bold">Devuelto</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-themed-muted text-xs">{tx.dateReturned ? new Date(tx.dateReturned).toLocaleDateString() : '-'}</td>
                                  </tr>
                                );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile History */}
                  <div className="md:hidden space-y-4">
                      {[...visibleTransactions]
                        .filter(tx => {
                            if (!historySearchTerm) return true;
                            const term = historySearchTerm.toLowerCase();
                            const book = books.find(b => b.id === tx.bookId);
                            const user = users.find(u => u.id === tx.userId);
                            const bookTitle = book?.title.toLowerCase() || '';
                            const userName = user ? `${user.firstName} ${user.lastName}`.toLowerCase() : '';
                            return bookTitle.includes(term) || userName.includes(term);
                        })
                        .sort((a,b) => new Date(b.dateBorrowed).getTime() - new Date(a.dateBorrowed).getTime())
                        .map(tx => {
                            const book = books.find(b => b.id === tx.bookId);
                            const user = users.find(u => u.id === tx.userId);
                            return (
                                <div key={tx.id} className="glass-card p-4 rounded-xl flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-themed text-sm truncate max-w-[200px]">{book?.title}</h4>
                                        {tx.active ? (
                                            <span className="bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold">Prestado</span>
                                        ) : (
                                            <span className="bg-green-500/15 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold">Devuelto</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-themed-muted">{user ? `${user.firstName} ${user.lastName}` : 'Usuario desconocido'}</p>
                                    <div className="flex justify-between items-center text-[10px] text-themed-muted border-t border-[var(--glass-border)] pt-2">
                                        <span>Prestado: {new Date(tx.dateBorrowed).toLocaleDateString()}</span>
                                        {tx.dateReturned && <span>Devuelto: {new Date(tx.dateReturned).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                            );
                        })
                      }
                  </div>
                </div>
              )}

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm animate-fade-in-up stagger-1">
                            <div className="text-themed-muted text-xs font-bold uppercase mb-1">Total Alumnos</div>
                            <div className="text-3xl font-display font-bold text-themed">{visibleUsers.filter(u => u.role === UserRole.STUDENT).length}</div>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm animate-fade-in-up stagger-2">
                            <div className="text-themed-muted text-xs font-bold uppercase mb-1">Libros en Catálogo</div>
                            <div className="text-3xl font-display font-bold text-themed">{books.length}</div>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm animate-fade-in-up stagger-3 glow-border-blue">
                            <div className="text-themed-muted text-xs font-bold uppercase mb-1">Préstamos Activos</div>
                            <div className="text-3xl font-display font-bold text-brand-500">{visibleTransactions.filter(t => t.active).length}</div>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm animate-fade-in-up stagger-4">
                            <div className="text-themed-muted text-xs font-bold uppercase mb-1">Opiniones</div>
                            <div className="text-3xl font-display font-bold text-fun-orange">{visibleReviews.length}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm glow-border-purple animate-fade-in-up stagger-5">
                            <h3 className="font-bold text-lg mb-4 text-themed">Lectores Top 🏆</h3>
                            <ul className="space-y-3">
                                {visibleUsers
                                    .filter(u => u.role === UserRole.STUDENT)
                                    .sort((a, b) => b.booksRead - a.booksRead)
                                    .slice(0, 5)
                                    .map((u, i) => (
                                        <li key={u.id} className={`flex justify-between items-center p-2 hover:bg-[var(--surface-raised)] rounded-lg animate-fade-in-up stagger-${i+1} ${i===0 ? 'animate-rainbow-glow rounded-xl' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i===0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-[var(--surface-raised)] text-themed-muted'}`}>{i+1}</div>
                                                <span className="font-medium text-themed">{u.firstName} {u.lastName}</span>
                                            </div>
                                            <div className="text-sm font-bold text-brand-400">{u.booksRead} libros</div>
                                        </li>
                                    ))
                                }
                            </ul>
                        </div>

                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm glow-border-blue animate-fade-in-up stagger-6">
                            <h3 className="font-bold text-lg mb-4 text-themed">Libros Más Leídos 📖</h3>
                            <ul className="space-y-3">
                                {books
                                    .map(b => {
                                        // If technical/superadmin, use global readCount.
                                        // If tutor, calculate based on visibleTransactions (filtered by class)
                                        if (isTechnical && viewScope === 'global') return b;
                                        const classReads = visibleTransactions.filter(t => t.bookId === b.id && !t.active).length;
                                        return { ...b, readCount: classReads };
                                    })
                                    .sort((a, b) => b.readCount - a.readCount)
                                    .filter(b => b.readCount > 0)
                                    .slice(0, 5)
                                    .map((b, i) => (
                                        <li key={b.id} className="flex justify-between items-center p-2 hover:bg-[var(--surface-raised)] rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--surface-raised)] text-themed-muted`}>{i+1}</div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-themed truncate max-w-[200px]">{b.title}</span>
                                                    <span className="text-[10px] text-themed-muted">{b.author}</span>
                                                </div>
                                            </div>
                                            <div className="text-sm font-bold text-brand-400">{b.readCount}</div>
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
                    <div className="glass-panel p-6 rounded-3xl shadow-glass-sm no-print">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold font-display text-themed">Generador de Carnets</h2>
                                <p className="text-themed-muted">Imprime los carnets por clase o individualmente.</p>
                            </div>
                            <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
                                {/* Mode Selector */}
                                <div className="flex gap-2">
                                    <div className="bg-[var(--surface-raised)] p-1 rounded-lg flex text-sm">
                                        <button
                                            className={`px-3 py-1.5 rounded-md transition-all ${cardPrintMode === 'class' ? 'bg-[var(--tab-active-bg)] text-brand-400 shadow-sm font-bold' : 'text-themed-muted hover:text-themed'}`}
                                            onClick={() => setCardPrintMode('class')}
                                        >
                                            Por Clase
                                        </button>
                                        <button
                                            className={`px-3 py-1.5 rounded-md transition-all ${cardPrintMode === 'individual' ? 'bg-[var(--tab-active-bg)] text-brand-400 shadow-sm font-bold' : 'text-themed-muted hover:text-themed'}`}
                                            onClick={() => setCardPrintMode('individual')}
                                        >
                                            Individual
                                        </button>
                                    </div>

                                    <div className="bg-[var(--surface-raised)] p-1 rounded-lg flex text-sm">
                                        <button
                                            className={`px-3 py-1.5 rounded-md transition-all ${!showBackSide ? 'bg-[var(--tab-active-bg)] text-brand-400 shadow-sm font-bold' : 'text-themed-muted hover:text-themed'}`}
                                            onClick={() => setShowBackSide(false)}
                                        >
                                            Anverso
                                        </button>
                                        <button
                                            className={`px-3 py-1.5 rounded-md transition-all ${showBackSide ? 'bg-[var(--tab-active-bg)] text-brand-400 shadow-sm font-bold' : 'text-themed-muted hover:text-themed'}`}
                                            onClick={() => setShowBackSide(true)}
                                        >
                                            Reverso
                                        </button>
                                    </div>
                                </div>

                                {cardPrintMode === 'class' ? (
                                    <select
                                        className="p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed"
                                        value={cardClassFilter}
                                        onChange={(e) => setCardClassFilter(e.target.value)}
                                    >
                                        <option value="all">Todas las clases</option>
                                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                ) : (
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-2.5 text-themed-muted"/>
                                        <input
                                            type="text"
                                            placeholder="Buscar alumno..."
                                            className="pl-9 pr-4 py-2 border border-[var(--glass-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-[var(--input-bg)] text-themed w-64"
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
                            <div className="col-span-full text-center py-12 text-themed-muted no-print">
                                <Search size={48} className="mx-auto mb-4 opacity-20"/>
                                <p>Busca un alumno para generar su carnet.</p>
                            </div>
                        )}
                    </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && isTechnical && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                            <h2 className="text-xl font-bold font-display text-themed mb-6">Configuración General</h2>
                            <form onSubmit={handleSaveSettings} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-themed-muted uppercase mb-2">Nombre del Colegio / Biblioteca</label>
                                    <input
                                        className="w-full p-3 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed font-medium"
                                        value={tempSettings.schoolName}
                                        onChange={e => setTempSettings({...tempSettings, schoolName: e.target.value})}
                                        placeholder="Ej: Biblioteca Escolar Cervantes"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-themed-muted uppercase mb-2">Logo (URL o Archivo)</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 bg-[var(--surface-raised)] border border-[var(--glass-border)] rounded-xl flex items-center justify-center p-2">
                                            {tempSettings.logoUrl ? (
                                                <img src={tempSettings.logoUrl} className="w-full h-full object-contain" alt="Logo Preview" />
                                            ) : (
                                                <ImageIcon className="text-themed-muted" size={32} />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed"
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

                                <div className="pt-4 border-t border-[var(--glass-border)] flex justify-end">
                                    <Button type="submit" disabled={settingsSaved}>
                                        {settingsSaved ? <Check size={18} className="mr-2"/> : <Save size={18} className="mr-2"/>}
                                        {settingsSaved ? 'Guardado' : 'Guardar Configuración'}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                            <h2 className="text-xl font-bold font-display text-themed mb-6">Seguridad</h2>
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div className="flex gap-4 items-start bg-yellow-500/15 p-4 rounded-xl mb-4">
                                    <Lock className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                                    <div>
                                        <h4 className="font-bold text-yellow-300 text-sm">Cambiar contraseña de Administrador</h4>
                                        <p className="text-xs text-yellow-400">Esto cambiará la contraseña de tu usuario actual ({currentUser.username}).</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-themed-muted uppercase mb-1">Nueva Contraseña</label>
                                        <input
                                            type="password"
                                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed"
                                            value={newAdminPassword}
                                            onChange={e => setNewAdminPassword(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-themed-muted uppercase mb-1">Confirmar</label>
                                        <input
                                            type="password"
                                            className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed"
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
                        <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                            <h2 className="text-xl font-bold font-display text-themed mb-4 flex items-center gap-2">
                                <RefreshCcw size={20} className="text-brand-500"/> Copias de Seguridad
                            </h2>
                            <p className="text-sm text-themed-muted mb-6">Descarga una copia de toda la base de datos o restaura una anterior.</p>

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
           </div>
        )}

        {/* BOOKS TAB - Special Layout for Fixed Headers */}
        {activeTab === 'books' && (
            <div className="h-full flex flex-col lg:grid lg:grid-cols-3 gap-6">
               <div className="flex-1 lg:col-span-2 h-full flex flex-col order-2 lg:order-1 min-h-0">
                  {/* Books Grid Preview - Flex Container */}
                  <div className="glass-panel rounded-3xl flex flex-col h-full overflow-hidden">
                     {/* FIXED HEADER FOR BOOK LIST */}
                     <div className="flex-none p-6 pb-2 border-b border-[var(--glass-border)]">
                         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-0 gap-4">
                            <h2 className="text-xl font-bold font-display text-themed whitespace-nowrap">Catálogo ({books.length})</h2>
                            <div className="flex gap-2 w-full md:w-auto justify-end">
                              <select
                                  className="flex-1 md:flex-none p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--input-bg)] text-themed text-sm md:max-w-[150px]"
                                  value={shelfFilter}
                                  onChange={(e) => setShelfFilter(e.target.value)}
                              >
                                  <option value="all">Todos los espacios</option>
                                  {availableShelves.map(shelf => (
                                      <option key={shelf} value={shelf}>{shelf}</option>
                                  ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Buscar libro..."
                                className="flex-[2] md:flex-none pl-4 pr-4 py-2 border border-[var(--glass-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm w-full md:w-64 bg-[var(--input-bg)] text-themed min-w-0"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                              />
                            </div>
                         </div>
                     </div>

                     {/* SCROLLABLE GRID */}
                     <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar pb-24 lg:pb-6">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {books
                            .filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()))
                            .filter(b => shelfFilter === 'all' || (b.shelf || 'Recepción') === shelfFilter)
                            .map(book => (
                               <div key={book.id} className="flex gap-3 items-start p-3 border border-[var(--glass-border)] rounded-xl hover:bg-[var(--surface-raised)] group">
                                  <div className="w-16 h-24 bg-gradient-to-br from-brand-500/10 to-brand-500/20 rounded shadow-sm flex items-center justify-center text-xs text-themed-muted font-bold p-1 text-center relative overflow-hidden flex-shrink-0">
                                     <span>{book.title.substring(0, 30)}</span>
                                     {book.coverUrl && (
                                        <img src={proxyCoverUrl(book.coverUrl)} className="absolute inset-0 w-full h-full object-cover" alt="" loading="lazy"
                                           onError={(e) => { e.currentTarget.style.display = 'none'; }}/>
                                     )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <h4 className="font-bold text-themed truncate text-sm" title={book.title}>{book.title}</h4>
                                     <p className="text-xs text-themed-muted mb-1">{book.author}</p>
                                     <div className="flex gap-2 text-xs text-themed-muted mb-2 flex-wrap">
                                       <span>{book.shelf}</span>
                                       <span className={book.unitsAvailable > 0 ? "text-green-600" : "text-red-500"}>{book.unitsAvailable}/{book.unitsTotal}</span>
                                       {book.recommendedAge && <span className="text-purple-500 font-bold">{book.recommendedAge}</span>}
                                     </div>
                                     <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleStartEditing(book)} className="text-xs text-brand-500 hover:text-brand-300 flex items-center gap-1">
                                            <Edit2 size={12}/> Editar
                                        </button>
                                        <button onClick={() => onDeleteBook(book.id)} className="text-xs text-red-500 hover:text-red-300 flex items-center gap-1">
                                            <Trash2 size={12}/> Eliminar
                                        </button>
                                     </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                     </div>
                  </div>
               </div>

               <div className="order-1 lg:order-2 flex-none lg:h-full lg:overflow-y-auto no-scrollbar">
                 <MobileActionsToggle label="Añadir / Importar Libros" />
                 <div className={`space-y-6 ${isMobileActionsOpen ? 'block' : 'hidden'} lg:block`}>
                     {/* Add Book Panel */}
                     <div className="glass-panel p-6 rounded-3xl shadow-glass-sm">
                        <h3 className="font-bold text-lg mb-4 text-themed">Añadir Libro</h3>

                    <form onSubmit={handleSaveBook} className="space-y-3">
                        <div className="flex gap-2 mb-2">
                            {newBook.coverUrl && (
                                <img src={proxyCoverUrl(newBook.coverUrl)} className="w-16 h-24 object-cover rounded shadow-sm bg-[var(--surface-raised)]" alt="Cover"/>
                            )}
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-themed-muted uppercase">Título *</label>
                                <div className="flex gap-2">
                                    <input
                                        className="w-full p-1.5 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed font-bold"
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

                                <label className="text-[10px] font-bold text-themed-muted uppercase mt-1">Autor</label>
                                <input
                                    className="w-full p-1.5 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed"
                                    value={newBook.author || ''}
                                    onChange={e => setNewBook({...newBook, author: e.target.value})}
                                    onBlur={handleBlur}
                                    placeholder="Ej: J.K. Rowling"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-themed-muted uppercase">
                                    {newBook.shelf === 'BIBLIOTECA' ? 'Subcategoría' : 'Género'}
                                </label>
                                {newBook.shelf === 'BIBLIOTECA' ? (
                                    <select
                                        className="w-full p-1.5 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed"
                                        value={newBook.genre || ''}
                                        onChange={e => setNewBook({...newBook, genre: e.target.value})}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {LIBRARY_SUBCATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="w-full p-1.5 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed"
                                        value={newBook.genre || ''}
                                        onChange={e => setNewBook({...newBook, genre: e.target.value})}
                                        placeholder="Ej: Fantasía"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-themed-muted uppercase">Edad</label>
                                <select
                                    className="w-full p-1.5 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed"
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
                                <label className="text-[10px] font-bold text-themed-muted uppercase">Unidades</label>
                                <input
                                    type="number" min="1"
                                    className="w-full p-1.5 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed"
                                    value={newBook.unitsTotal || 1}
                                    onChange={e => setNewBook({...newBook, unitsTotal: parseInt(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-themed-muted uppercase">Espacio</label>
                                <select
                                    className="w-full p-1.5 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed"
                                    value={newBook.shelf || ''}
                                    onChange={e => setNewBook({...newBook, shelf: e.target.value})}
                                >
                                    <option value="Recepción">Recepción</option>
                                    <option value="BIBLIOTECA">BIBLIOTECA</option>
                                    {availableClasses.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-themed-muted uppercase">Sinopsis</label>
                            <textarea
                                className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-xs bg-[var(--surface-raised)] text-themed h-20"
                                value={newBook.description || ''}
                                onChange={e => setNewBook({...newBook, description: e.target.value})}
                            />
                        </div>

                        {isAddingBook && (
                             <div className="bg-blue-500/15 text-blue-400 text-xs p-2 rounded-lg flex items-center gap-2">
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
                   <p className="text-xs text-purple-600 mb-3">Formato: Título, Autor, Género, Unidades, Espacio, Edad Rec.</p>
                   <div className="mb-4">
                      <label className="block text-xs font-bold text-purple-300 uppercase mb-1">Codificación del Archivo</label>
                      <select
                        value={csvEncoding}
                        onChange={(e) => setCsvEncoding(e.target.value)}
                        className="w-full p-2 border border-purple-500/20 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-[var(--input-bg)] text-themed"
                      >
                        <option value="windows-1252">Excel / ANSI (Recomendado)</option>
                        <option value="UTF-8">UTF-8 (Estándar)</option>
                      </select>
                   </div>

                   {/* PROGRESS BAR */}
                   {isImportingBooks && (
                       <div className="mb-4 bg-[var(--surface-raised)] p-3 rounded-xl border border-purple-500/20">
                            <div className="flex justify-between text-xs font-bold text-purple-300 mb-1">
                                 <span>{loadingMessage}</span>
                                 <span>{loadingProgress}%</span>
                            </div>
                            <div className="w-full bg-purple-500/15 rounded-full h-2.5 overflow-hidden">
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
                     <div className={`w-full bg-[var(--input-bg)] border-2 border-dashed border-purple-500/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors text-purple-400 ${isImportingBooks ? 'opacity-50 pointer-events-none' : ''}`}>
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
            </div>
        )}
      </div>

      {/* CANDIDATES SELECTION MODAL */}
      {showCandidates && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="glass-panel rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] modal-glass animate-scale-in">
            <div className="flex justify-between items-center mb-4">
               <div>
                  <h3 className="text-xl font-bold font-display text-themed flex items-center gap-2">
                    <Wand2 className="text-brand-500" size={24}/>
                    Elige el libro correcto
                  </h3>
                  <p className="text-sm text-themed-muted">Hemos encontrado varias coincidencias.</p>
               </div>
               <button onClick={() => { setShowCandidates(false); setIsCoverSelectionMode(false); }} className="text-themed-muted hover:text-themed-secondary bg-[var(--surface-raised)] p-2 rounded-full">
                  <X size={20} />
               </button>
            </div>
            
            {isCoverSelectionMode ? (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <p className="text-sm text-themed-muted mb-2">Selecciona una imagen para usarla como portada:</p>
                    <form onSubmit={(e) => { e.preventDefault(); if (coverSearchQuery.trim()) handleSearchAlternativeCovers(coverSearchQuery.trim()); }} className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={coverSearchQuery}
                            onChange={(e) => setCoverSearchQuery(e.target.value)}
                            placeholder="Buscar por título, autor..."
                            className="flex-1 p-2 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed focus:ring-2 focus:ring-brand-300 outline-none"
                        />
                        <Button type="submit" size="sm" variant="secondary" disabled={!coverSearchQuery.trim() || isSearchingCovers}>
                            {isSearchingCovers ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
                        </Button>
                    </form>
                    {candidates.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-themed-muted">
                            <Loader2 className="animate-spin mb-3" size={32}/>
                            <p className="text-sm">Buscando portadas...</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {candidates.map((cand, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSelectCandidate(cand)}
                                className="aspect-[2/3] bg-[var(--surface-raised)] rounded-lg cursor-pointer hover:ring-4 hover:ring-brand-200 transition-all overflow-hidden relative group"
                            >
                                <div className="w-full h-full flex items-center justify-center text-xs text-themed-muted p-2 text-center">{cand.title || 'Sin imagen'}</div>
                                {cand.coverUrl && (
                                    <img src={proxyCoverUrl(cand.coverUrl)} className="absolute inset-0 w-full h-full object-cover" alt=""
                                       onError={(e) => { e.currentTarget.style.display = 'none'; }}/>
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
                            className="flex gap-4 p-3 border border-[var(--glass-border)] rounded-xl hover:bg-brand-500/10 cursor-pointer transition-colors group"
                            onClick={() => handleSelectCandidate(cand)}
                        >
                            <div className="w-16 h-24 bg-[var(--surface-raised)] rounded-lg flex-shrink-0 overflow-hidden relative">
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-themed-muted text-center p-1">{cand.title?.substring(0, 30) || 'Sin imagen'}</div>
                                {cand.coverUrl && (
                                    <img src={proxyCoverUrl(cand.coverUrl)} className="absolute inset-0 w-full h-full object-cover" alt=""
                                       onError={(e) => { e.currentTarget.style.display = 'none'; }}/>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-themed text-sm">{cand.title}</h4>
                                <p className="text-xs text-themed-secondary">{cand.author}</p>
                                <p className="text-[10px] text-themed-muted mt-1 line-clamp-2">{cand.description}</p>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] bg-[var(--surface-raised)] px-2 py-0.5 rounded text-themed-muted">{cand.genre}</span>
                                    {cand.publishedDate && <span className="text-[10px] bg-[var(--surface-raised)] px-2 py-0.5 rounded text-themed-muted">{cand.publishedDate.split('-')[0]}</span>}
                                </div>
                            </div>
                            <div className="flex items-center">
                                <ArrowRight size={20} className="text-themed-muted group-hover:text-brand-500" />
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
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="glass-panel rounded-3xl p-6 w-full max-w-md shadow-glass-xl modal-glass animate-modal-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold font-display text-themed">Editar Usuario</h3>
                    <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-[var(--surface-raised)] rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-themed-muted uppercase mb-1">Nombre</label>
                        <input className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed" value={editingUser.firstName} onChange={e => setEditingUser({...editingUser, firstName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-themed-muted uppercase mb-1">Apellido</label>
                        <input className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed" value={editingUser.lastName} onChange={e => setEditingUser({...editingUser, lastName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-themed-muted uppercase mb-1">Clase</label>
                        <input className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed" value={editingUser.className} onChange={e => setEditingUser({...editingUser, className: e.target.value})} />
                    </div>
                    {editingUser.role === UserRole.STUDENT && (
                        <div>
                            <label className="block text-xs font-bold text-themed-muted uppercase mb-1">Usuario (Auto-generado)</label>
                            <div className="p-2 bg-[var(--surface-raised)] border border-[var(--glass-border)] rounded-lg text-themed-muted text-sm font-mono">
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
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="glass-panel rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col modal-glass animate-scale-in">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-bold font-display text-themed">Gestión de Puntos</h3>
                        <p className="text-sm text-themed-muted">{managingPointsUser.firstName} {managingPointsUser.lastName} • <span className="font-bold text-fun-orange">{managingPointsUser.points} XP</span></p>
                    </div>
                    <button onClick={() => setManagingPointsUser(null)} className="p-2 hover:bg-[var(--surface-raised)] rounded-full"><X size={20}/></button>
                </div>

                <div className="bg-[var(--surface-raised)] p-4 rounded-xl mb-4 border border-[var(--glass-border)]">
                    <h4 className="font-bold text-sm text-themed mb-2">Añadir / Restar Puntos</h4>
                    <form onSubmit={handleAddPointsSubmit} className="flex gap-2 items-end">
                        <div className="flex-1">
                             <label className="block text-[10px] font-bold text-themed-muted uppercase mb-1">Motivo</label>
                             <input className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed" placeholder="Ej: Ayudar en biblioteca" value={pointsReason} onChange={e => setPointsReason(e.target.value)} />
                        </div>
                        <div className="w-24">
                             <label className="block text-[10px] font-bold text-themed-muted uppercase mb-1">Cantidad</label>
                             <input type="number" className="w-full p-2 border border-[var(--glass-border)] rounded-lg text-sm bg-[var(--input-bg)] text-themed" placeholder="+10 / -5" value={pointsAmount || ''} onChange={e => setPointsAmount(parseInt(e.target.value))} />
                        </div>
                        <Button type="submit" disabled={!pointsReason || !pointsAmount}>
                            <Plus size={18}/>
                        </Button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <h4 className="font-bold text-sm text-themed mb-2">Historial</h4>
                    {pointHistory.filter(h => h.userId === managingPointsUser.id).length === 0 ? (
                        <p className="text-sm text-themed-muted text-center py-4">No hay historial de puntos.</p>
                    ) : (
                        <div className="space-y-2">
                            {pointHistory.filter(h => h.userId === managingPointsUser.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(h => (
                                <div key={h.id} className="flex justify-between items-center p-3 border border-[var(--glass-border)] rounded-xl bg-[var(--surface-raised)] text-sm">
                                    <div>
                                        <div className="font-bold text-themed">{h.reason}</div>
                                        <div className="text-xs text-themed-muted">{new Date(h.date).toLocaleDateString()}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${h.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {h.amount > 0 ? '+' : ''}{h.amount}
                                        </span>
                                        <button onClick={() => onDeletePointEntry(h.id)} className="text-themed-muted hover:text-red-500">
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
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="glass-panel rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto modal-glass animate-scale-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold font-display text-themed">Editar Libro</h3>
                    <button onClick={() => { setEditingBook(null); setShowCandidates(false); setIsCoverSelectionMode(false); }} className="p-2 hover:bg-[var(--surface-raised)] rounded-full"><X size={20}/></button>
                </div>

                <div className="space-y-3">
                    <div className="flex gap-4">
                        <div className="w-20 h-32 bg-gradient-to-br from-brand-500/10 to-brand-500/20 rounded flex items-center justify-center text-xs text-themed-muted font-bold p-1 text-center relative overflow-hidden flex-shrink-0">
                            <span>{editingBook.title.substring(0, 30)}</span>
                            {editingBook.coverUrl && (
                                <img src={proxyCoverUrl(editingBook.coverUrl)} className="absolute inset-0 w-full h-full object-cover" alt=""
                                   onError={(e) => { e.currentTarget.style.display = 'none'; }}/>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                            <input className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed placeholder:text-themed-muted" value={editingBook.title} onChange={e => setEditingBook({...editingBook, title: e.target.value})} placeholder="Título" />
                            <input className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed placeholder:text-themed-muted" value={editingBook.author} onChange={e => setEditingBook({...editingBook, author: e.target.value})} placeholder="Autor" />
                            <Button size="sm" variant="outline" onClick={handleSearchAlternativeCovers}><Wand2 size={14} className="mr-2"/> Buscar Portada Alternativa</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {editingBook.shelf === 'BIBLIOTECA' ? (
                            <select
                                className="p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed"
                                value={editingBook.genre || ''}
                                onChange={e => setEditingBook({...editingBook, genre: e.target.value})}
                            >
                                <option value="">Seleccionar...</option>
                                {LIBRARY_SUBCATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                className="p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed placeholder:text-themed-muted"
                                value={editingBook.genre}
                                onChange={e => setEditingBook({...editingBook, genre: e.target.value})}
                                placeholder="Género"
                            />
                        )}
                        <select
                            className="p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed"
                            value={editingBook.recommendedAge || ''}
                            onChange={e => setEditingBook({...editingBook, recommendedAge: e.target.value})}
                        >
                            <option value="">Seleccionar Edad</option>
                            {['0-5', '6-8', '9-11', '12-14', '+15'].map(age => (
                                <option key={age} value={age}>{age}</option>
                            ))}
                        </select>
                        <input type="number" className="p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed placeholder:text-themed-muted" value={editingBook.unitsTotal} onChange={e => setEditingBook({...editingBook, unitsTotal: parseInt(e.target.value)})} placeholder="Unidades" />
                        <select
                            className="p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed"
                            value={editingBook.shelf || ''}
                            onChange={e => setEditingBook({...editingBook, shelf: e.target.value})}
                        >
                            <option value="Recepción">Recepción</option>
                            <option value="BIBLIOTECA">BIBLIOTECA</option>
                            {availableClasses.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <textarea className="w-full p-2 border border-[var(--glass-border)] rounded-lg bg-[var(--input-bg)] text-themed placeholder:text-themed-muted h-24 text-sm" value={editingBook.description || ''} onChange={e => setEditingBook({...editingBook, description: e.target.value})} placeholder="Sinopsis" />

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => { setEditingBook(null); setShowCandidates(false); setIsCoverSelectionMode(false); }}>Cancelar</Button>
                        <Button onClick={handleSaveEdit}><Save size={16} className="mr-2"/> Guardar Cambios</Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Report Selection Modal */}
      {reportUser && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="glass-panel rounded-3xl p-6 w-full max-w-sm shadow-glass-xl modal-glass animate-modal-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold font-display text-themed">Informe de Préstamos</h3>
                    <button onClick={() => setReportUser(null)} className="p-2 hover:bg-[var(--surface-raised)] rounded-full"><X size={20}/></button>
                </div>
                <p className="text-sm text-themed-muted mb-4">
                    Selecciona el periodo para el informe de <strong>{reportUser.firstName} {reportUser.lastName}</strong>.
                </p>

                <div className="space-y-3">
                    <Button className="w-full justify-between" onClick={() => { generateStudentLoanReport(reportUser, transactions, books, 'monthly', settings.schoolName, settings.logoUrl); setReportUser(null); }}>
                        <span>Último Mes</span> <FileText size={16}/>
                    </Button>
                    <Button className="w-full justify-between" onClick={() => { generateStudentLoanReport(reportUser, transactions, books, 'quarterly', settings.schoolName, settings.logoUrl); setReportUser(null); }}>
                        <span>Último Trimestre</span> <FileText size={16}/>
                    </Button>
                    <Button className="w-full justify-between" onClick={() => { generateStudentLoanReport(reportUser, transactions, books, 'annual', settings.schoolName, settings.logoUrl); setReportUser(null); }}>
                        <span>Último Año (Anual)</span> <FileText size={16}/>
                    </Button>
                </div>
            </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {activeTab === 'menu' && (
        <div className="md:hidden fixed inset-0 z-40 bg-[var(--surface-base)] backdrop-blur-xl pt-20 px-6 animate-slide-in-bottom overflow-y-auto pb-24">
            <h2 className="text-2xl font-bold font-display text-themed mb-6">Más Opciones</h2>
            <div className="grid grid-cols-2 gap-4">
                {isSuperAdmin && (
                    <button onClick={() => setActiveTab('teachers')} className="glass-card p-5 rounded-3xl flex flex-col items-center gap-3 press-effect">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Shield size={24} />
                        </div>
                        <span className="font-bold text-themed text-sm">Profesores</span>
                    </button>
                )}
                <button onClick={() => setActiveTab('reviews')} className="glass-card p-5 rounded-3xl flex flex-col items-center gap-3 press-effect">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                        <MessageSquare size={24} />
                    </div>
                    <span className="font-bold text-themed text-sm">Opiniones</span>
                </button>
                <button onClick={() => setActiveTab('cards')} className="glass-card p-5 rounded-3xl flex flex-col items-center gap-3 press-effect">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                        <CreditCard size={24} />
                    </div>
                    <span className="font-bold text-themed text-sm">Carnets</span>
                </button>
                {isTechnical && (
                    <button onClick={() => { setActiveTab('settings'); setTempSettings(settings); }} className="glass-card p-5 rounded-3xl flex flex-col items-center gap-3 press-effect">
                        <div className="w-12 h-12 bg-gradient-to-br from-brand-500/10 to-brand-500/15 rounded-2xl flex items-center justify-center text-themed-secondary">
                            <Settings size={24} />
                        </div>
                        <span className="font-bold text-themed text-sm">Ajustes</span>
                    </button>
                )}
                {setTheme && (
                    <div className="glass-card p-5 rounded-3xl flex flex-col items-center gap-3 col-span-2">
                        <span className="font-bold text-themed text-sm mb-1">Tema</span>
                        <div className="flex theme-toggle-group rounded-lg p-0.5">
                          <button onClick={() => setTheme('light')} className={`flex justify-center p-2.5 rounded-md transition-colors ${theme === 'light' ? 'theme-toggle-active' : 'text-themed-muted hover:text-themed-secondary'}`} title="Modo claro">
                            <Sun size={18} />
                          </button>
                          <button onClick={() => setTheme('system')} className={`flex justify-center p-2.5 rounded-md transition-colors ${theme === 'system' ? 'theme-toggle-active' : 'text-themed-muted hover:text-themed-secondary'}`} title="Automático">
                            <Monitor size={18} />
                          </button>
                          <button onClick={() => setTheme('dark')} className={`flex justify-center p-2.5 rounded-md transition-colors ${theme === 'dark' ? 'theme-toggle-active' : 'text-themed-muted hover:text-themed-secondary'}`} title="Modo oscuro">
                            <Moon size={18} />
                          </button>
                        </div>
                    </div>
                )}
                <button onClick={onLogout} className="bg-red-500/15 backdrop-blur-sm p-5 rounded-3xl border border-red-500/20 flex flex-col items-center gap-3 press-effect col-span-2 mt-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center text-red-600">
                        <LogOut size={24} />
                    </div>
                    <span className="font-bold text-red-600 text-sm">Cerrar Sesión</span>
                </button>
            </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-bottom-nav p-2 pb-safe flex justify-around items-center z-50">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'users' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
        >
          <Users size={22} strokeWidth={activeTab === 'users' ? 2.5 : 1.5} />
          <span className="text-[10px] font-bold mt-0.5">Alumnos</span>
        </button>
        <button
          onClick={() => setActiveTab('books')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'books' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
        >
          <BookOpen size={22} strokeWidth={activeTab === 'books' ? 2.5 : 1.5} />
          <span className="text-[10px] font-bold mt-0.5">Libros</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'history' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
        >
          <Clock size={22} strokeWidth={activeTab === 'history' ? 2.5 : 1.5} />
          <span className="text-[10px] font-bold mt-0.5">Historial</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'stats' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
        >
          <BarChart3 size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 1.5} />
          <span className="text-[10px] font-bold mt-0.5">Stats</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'menu' || ['teachers', 'reviews', 'cards', 'settings'].includes(activeTab) ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
        >
          <Menu size={22} strokeWidth={activeTab === 'menu' || ['teachers', 'reviews', 'cards', 'settings'].includes(activeTab) ? 2.5 : 1.5} />
          <span className="text-[10px] font-bold mt-0.5">Menú</span>
        </button>
      </div>

    </div>
  );
};
