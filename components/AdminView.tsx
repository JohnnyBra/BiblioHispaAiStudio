
import React, { useState, useRef } from 'react';
import { User, Book, RawUserImport, RawBookImport, UserRole, Review, AppSettings } from '../types';
import { normalizeString } from '../services/storageService';
import { searchBookCover } from '../services/bookService';
import { Button } from './Button';
import { Upload, Plus, Trash2, Users, BookOpen, BarChart3, Search, Loader2, Edit2, X, Save, MessageSquare, Settings, Check, Image as ImageIcon, Lock, Key } from 'lucide-react';

interface AdminViewProps {
  users: User[];
  books: Book[];
  reviews?: Review[];
  settings: AppSettings;
  onAddUsers: (users: User[]) => void;
  onAddBooks: (books: Book[]) => void;
  onDeleteUser: (id: string) => void;
  onDeleteBook: (id: string) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onDeleteReview?: (id: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onChangePassword: (newPassword: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  users,
  books,
  reviews = [],
  settings,
  onAddUsers,
  onAddBooks,
  onDeleteUser,
  onDeleteBook,
  onUpdateUser,
  onDeleteReview,
  onUpdateSettings,
  onChangePassword
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'books' | 'reviews' | 'stats' | 'settings'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Single Entry States
  const [newUser, setNewUser] = useState({ name: '', lastname: '', className: '' });
  const [newBook, setNewBook] = useState({ title: '', author: '', genre: '', units: 1, shelf: '' });
  
  // Import Config State
  const [importClassName, setImportClassName] = useState('');
  const [csvEncoding, setCsvEncoding] = useState<string>('windows-1252');
  
  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Settings State
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  
  // Loading States
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isImportingBooks, setIsImportingBooks] = useState(false);

  // References for file inputs
  const userFileInputRef = useRef<HTMLInputElement>(null);
  const bookFileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleUserCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate Class Name Input
    if (!importClassName.trim()) {
      alert("⚠️ Por favor, escribe el nombre de la CLASE antes de subir el archivo (ej: 5ºA).");
      if (userFileInputRef.current) userFileInputRef.current.value = ''; // Reset input
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
      
      // Strategy 1: Check for "Surname, Name" format (common in Spain)
      // Checks if lines generally look like "Text, Text"
      const looksLikeSurnameCommaName = lines.slice(0, 5).every(l => l.includes(',') && !l.includes(';'));

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip obvious headers if they contain "Nombre" or "Apellido"
        if (line.toLowerCase().includes('nombre') && line.toLowerCase().includes('apellido')) continue;

        let firstName = '';
        let lastName = '';

        if (looksLikeSurnameCommaName) {
           // FORMAT: "Apellidos, Nombre"
           const parts = line.split(',');
           if (parts.length >= 2) {
             lastName = parts[0].trim();
             firstName = parts[1].trim();
           }
        } else {
           // FORMAT: CSV Columns (Default: Surname; Name OR Surname,Name)
           // Support both comma and semicolon
           const parts = line.split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
           // Assuming Col 0: Surnames, Col 1: Name (Standard list format in Spain)
           if (parts.length >= 2) {
             lastName = parts[0];
             firstName = parts[1];
           }
        }

        if (firstName && lastName) {
           // Generate username ensuring order: name.lastname
           const generatedUsername = `${normalizeString(firstName)}.${normalizeString(lastName)}`;

           parsedUsers.push({
            id: `user-${Date.now()}-${i}-${Math.random().toString(36).substr(2,4)}`,
            firstName,
            lastName,
            username: generatedUsername,
            className: targetClass, // Use the globally set class
            role: UserRole.STUDENT,
            points: 0,
            booksRead: 0
          });
          importedCount++;
        }
      }
      
      if (parsedUsers.length > 0) {
        onAddUsers(parsedUsers);
        alert(`✅ Se han importado ${importedCount} alumnos a la clase "${targetClass}".`);
        setImportClassName(''); // Reset class input
      } else {
        alert("⚠️ No se pudieron leer usuarios. Asegúrate del formato: 'Apellidos, Nombre'");
      }
    };
    
    // Use selected encoding (defaults to windows-1252 for ANSI/Excel)
    reader.readAsText(file, csvEncoding);
    
    if (userFileInputRef.current) userFileInputRef.current.value = '';
  };

  const handleBookCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingBooks(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      const startIndex = lines[0].toLowerCase().includes('titulo') ? 1 : 0;
      
      const parsedBooks: Book[] = [];
      const promises: Promise<void>[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
        
        if (parts.length >= 2) { // Allow importing with just Title, Author
          const title = parts[0];
          const author = parts[1];
          const genre = parts[2] || 'General';
          const units = parseInt(parts[3]) || 1;
          const shelf = parts[4] || 'Recepción';

          if (title) {
            // Create promise to fetch cover
            const p = searchBookCover(title, author).then(coverUrl => {
               parsedBooks.push({
                id: `book-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
                title,
                author,
                genre,
                unitsTotal: units,
                unitsAvailable: units,
                shelf,
                coverUrl,
                readCount: 0
              });
            });
            promises.push(p);
          }
        }
      }

      await Promise.all(promises);
      
      setIsImportingBooks(false);
      onAddBooks(parsedBooks);
      alert(`✅ Se han importado ${parsedBooks.length} libros con sus portadas.`);
    };
    
    // Use selected encoding (defaults to windows-1252 for ANSI/Excel)
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
  };

  const handleAddSingleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.title || !newBook.author) return;

    setIsAddingBook(true);
    
    const coverUrl = await searchBookCover(newBook.title, newBook.author);

    const book: Book = {
      id: `book-${Date.now()}`,
      title: newBook.title,
      author: newBook.author,
      genre: newBook.genre,
      unitsTotal: newBook.units,
      unitsAvailable: newBook.units,
      shelf: newBook.shelf,
      coverUrl: coverUrl,
      readCount: 0
    };
    
    onAddBooks([book]);
    setIsAddingBook(false);
    setNewBook({ title: '', author: '', genre: '', units: 1, shelf: '' });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser && onUpdateUser) {
      // Regenerate username in case names changed
      const updatedUser = {
        ...editingUser,
        username: `${normalizeString(editingUser.firstName)}.${normalizeString(editingUser.lastName)}`
      };
      onUpdateUser(updatedUser);
      setEditingUser(null);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setTempSettings({...tempSettings, logoUrl: e.target.result as string});
        }
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
      alert("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      alert("Las contraseñas no coinciden.");
      return;
    }
    onChangePassword(newAdminPassword);
    setNewAdminPassword('');
    setConfirmAdminPassword('');
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  // --- Render ---

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 p-2 border border-slate-100 rounded-xl flex items-center justify-center bg-slate-50">
             <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-800">Panel de Administración</h1>
            <p className="text-slate-500">Gestionando {settings.schoolName}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button 
            variant={activeTab === 'users' ? 'primary' : 'outline'} 
            onClick={() => setActiveTab('users')}
          >
            <Users size={18} /> Usuarios
          </Button>
          <Button 
            variant={activeTab === 'books' ? 'primary' : 'outline'} 
            onClick={() => setActiveTab('books')}
          >
            <BookOpen size={18} /> Libros
          </Button>
          <Button 
            variant={activeTab === 'reviews' ? 'primary' : 'outline'} 
            onClick={() => setActiveTab('reviews')}
          >
            <MessageSquare size={18} /> Opiniones
          </Button>
           <Button 
            variant={activeTab === 'stats' ? 'primary' : 'outline'} 
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 size={18} /> Estadísticas
          </Button>
          <Button 
            variant={activeTab === 'settings' ? 'primary' : 'outline'} 
            onClick={() => { setActiveTab('settings'); setTempSettings(settings); }}
          >
            <Settings size={18} />
          </Button>
        </div>
      </header>

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
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
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
                           <button onClick={() => setEditingUser(user)} className="text-brand-400 hover:text-brand-600 p-2 hover:bg-brand-50 rounded-lg transition-colors" title="Editar">
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
                  <input className="w-full p-2 border border-slate-200 rounded-xl" placeholder="Nombre" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                  <input className="w-full p-2 border border-slate-200 rounded-xl" placeholder="Apellido" value={newUser.lastname} onChange={e => setNewUser({...newUser, lastname: e.target.value})} />
                  <input className="w-full p-2 border border-slate-200 rounded-xl" placeholder="Clase (ej. 3A)" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})} />
                  <Button type="submit" className="w-full">
                    <Plus size={18}/> Crear Usuario
                  </Button>
                </form>
             </div>

             {/* CSV Import */}
             <div className="bg-brand-50 p-6 rounded-3xl border border-brand-100">
               <h3 className="font-bold text-lg mb-2 text-brand-800">Importar Alumnos CSV</h3>
               <p className="text-sm text-brand-600 mb-4 leading-relaxed">
                 1. Escribe la clase abajo.<br/>
                 2. Sube la lista (formato: <strong>Apellidos, Nombre</strong>).
               </p>
               
               <div className="mb-4">
                  <label className="block text-xs font-bold text-brand-700 uppercase mb-1">Clase para esta lista</label>
                  <input 
                    type="text"
                    className="w-full p-2 border border-brand-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
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
                    className="w-full p-2 border border-brand-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white"
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
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold font-display text-slate-700">Catálogo ({books.length})</h2>
                    <input 
                    type="text" 
                    placeholder="Buscar libro..." 
                    className="pl-4 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {books
                    .filter(b => b.title.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(book => (
                       <div key={book.id} className="flex gap-3 items-start p-3 border border-slate-100 rounded-xl hover:bg-slate-50 group">
                          <img src={book.coverUrl} className="w-16 h-24 object-cover rounded shadow-sm bg-slate-200" alt="cover"/>
                          <div className="flex-1 min-w-0">
                             <h4 className="font-bold text-slate-800 truncate text-sm" title={book.title}>{book.title}</h4>
                             <p className="text-xs text-slate-500 mb-1">{book.author}</p>
                             <div className="flex gap-2 text-xs text-slate-400 mb-2">
                               <span>Estante: {book.shelf}</span>
                               <span>Stock: {book.unitsAvailable}/{book.unitsTotal}</span>
                             </div>
                             <button onClick={() => onDeleteBook(book.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={12}/> Eliminar
                             </button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
           
           <div className="space-y-6">
             {/* Add Single Book */}
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg mb-4 text-slate-700">Añadir Libro</h3>
                <form onSubmit={handleAddSingleBook} className="space-y-3">
                  <input className="w-full p-2 border border-slate-200 rounded-xl" placeholder="Título" value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} />
                  <input className="w-full p-2 border border-slate-200 rounded-xl" placeholder="Autor" value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} />
                  <div className="flex gap-2">
                     <input className="w-1/2 p-2 border border-slate-200 rounded-xl" placeholder="Género" value={newBook.genre} onChange={e => setNewBook({...newBook, genre: e.target.value})} />
                     <input className="w-1/2 p-2 border border-slate-200 rounded-xl" placeholder="Estantería" value={newBook.shelf} onChange={e => setNewBook({...newBook, shelf: e.target.value})} />
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="text-sm text-slate-500">Unidades:</span>
                     <input type="number" min="1" className="w-20 p-2 border border-slate-200 rounded-xl" value={newBook.units} onChange={e => setNewBook({...newBook, units: parseInt(e.target.value)})} />
                  </div>
                  <Button type="submit" className="w-full" isLoading={isAddingBook}>
                    <Plus size={18}/> Guardar Libro
                  </Button>
                </form>
             </div>

             {/* CSV Import */}
             <div className="bg-fun-purple/10 p-6 rounded-3xl border border-fun-purple/20">
               <h3 className="font-bold text-lg mb-2 text-fun-purple">Importar Libros CSV</h3>
               <p className="text-sm text-purple-600 mb-4">
                 Sube tu catálogo en CSV. <br/>
                 <strong>Orden:</strong> Título, Autor, Género, Unidades, Estante
               </p>

               <div className="mb-4">
                  <label className="block text-xs font-bold text-purple-700 uppercase mb-1">Codificación del Archivo</label>
                  <select 
                    value={csvEncoding}
                    onChange={(e) => setCsvEncoding(e.target.value)}
                    className="w-full p-2 border border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                  >
                    <option value="windows-1252">Excel / ANSI (Recomendado)</option>
                    <option value="UTF-8">UTF-8 (Estándar)</option>
                  </select>
               </div>

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
                    <span className="font-semibold">{isImportingBooks ? 'Buscando portadas...' : 'Subir catálogo'}</span>
                 </div>
               </label>
             </div>
          </div>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold font-display text-slate-700">Opiniones y Reseñas</h2>
           </div>
           
           {reviews.length === 0 ? (
             <div className="text-center py-10 text-slate-400">
               <MessageSquare size={48} className="mx-auto mb-2 opacity-50"/>
               <p>Aún no hay reseñas de los alumnos.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {reviews.map(review => {
                  const book = books.find(b => b.id === review.bookId);
                  return (
                    <div key={review.id} className="border border-slate-100 p-4 rounded-xl flex flex-col gap-2 hover:bg-slate-50">
                       <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">{book?.title || 'Libro desconocido'}</h4>
                            <p className="text-xs text-slate-500">por {review.authorName}</p>
                          </div>
                          <div className="flex gap-1 text-yellow-400">
                             {[...Array(5)].map((_, i) => (
                               <svg key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-slate-200 fill-slate-200'}`} viewBox="0 0 20 20">
                                 <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                               </svg>
                             ))}
                          </div>
                       </div>
                       <p className="text-sm text-slate-600 italic">"{review.comment}"</p>
                       <div className="flex justify-end pt-2 border-t border-slate-100 mt-auto">
                          {onDeleteReview && (
                            <button onClick={() => onDeleteReview(review.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                               <Trash2 size={12} /> Borrar
                            </button>
                          )}
                       </div>
                    </div>
                  );
               })}
             </div>
           )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
         <div className="bg-white p-8 rounded-3xl shadow-sm text-center py-20">
            <h2 className="text-2xl font-bold text-slate-300 mb-4">Estadísticas de la Biblioteca</h2>
            <div className="flex justify-center gap-8">
               <div className="text-center">
                  <div className="text-4xl font-bold text-brand-600">{users.filter(u => u.role === UserRole.STUDENT).length}</div>
                  <div className="text-slate-500">Alumnos</div>
               </div>
               <div className="text-center">
                  <div className="text-4xl font-bold text-fun-purple">{books.length}</div>
                  <div className="text-slate-500">Títulos</div>
               </div>
               <div className="text-center">
                  <div className="text-4xl font-bold text-fun-green">{books.reduce((acc, b) => acc + b.readCount, 0)}</div>
                  <div className="text-slate-500">Préstamos Totales</div>
               </div>
            </div>
         </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 font-display">Configuración General</h2>
              
              <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Nombre de la Aplicación</label>
                    <input 
                        type="text" 
                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        value={tempSettings.schoolName}
                        onChange={e => setTempSettings({...tempSettings, schoolName: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Logo del Colegio</label>
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                        <div className="w-24 h-24 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-2 overflow-hidden relative group">
                            <img src={tempSettings.logoUrl} alt="Preview" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 space-y-3">
                            {/* File Upload Option */}
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 mb-1">Subir imagen (PNG, JPG)</label>
                              <label className="flex items-center gap-2 w-full p-2 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors">
                                  <ImageIcon size={16} />
                                  <span>Elegir archivo...</span>
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                  />
                              </label>
                            </div>
                            
                            {/* URL Option Separator */}
                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-slate-100"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-300 text-[10px] font-bold">O PEGAR URL</span>
                                <div className="flex-grow border-t border-slate-100"></div>
                            </div>

                            {/* URL Input */}
                            <div>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm text-slate-600"
                                    value={tempSettings.logoUrl}
                                    onChange={e => setTempSettings({...tempSettings, logoUrl: e.target.value})}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <Button type="submit" variant="primary" disabled={settingsSaved}>
                        {settingsSaved ? (
                          <span className="flex items-center gap-2"><Check size={18} /> Guardado</span>
                        ) : (
                          <span className="flex items-center gap-2"><Save size={18} /> Guardar Configuración</span>
                        )}
                    </Button>
                  </div>
              </form>
           </div>

           {/* Security Settings */}
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-fit">
              <div className="flex items-center gap-2 mb-6 text-slate-800">
                <Lock className="text-brand-600" size={24}/>
                <h2 className="text-2xl font-bold font-display">Seguridad</h2>
              </div>
              
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 mb-4 border border-slate-100">
                  Cambia aquí la contraseña de administrador. Asegúrate de recordarla.
                </div>

                <div>
                   <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Nueva Contraseña</label>
                   <div className="relative">
                      <input 
                         type="password" 
                         className="w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                         value={newAdminPassword}
                         onChange={e => setNewAdminPassword(e.target.value)}
                         placeholder="••••••••"
                      />
                      <Key size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Confirmar Contraseña</label>
                   <div className="relative">
                      <input 
                         type="password" 
                         className="w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                         value={confirmAdminPassword}
                         onChange={e => setConfirmAdminPassword(e.target.value)}
                         placeholder="••••••••"
                      />
                      <Key size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <Button type="submit" variant="secondary" disabled={passwordSaved || !newAdminPassword}>
                        {passwordSaved ? (
                          <span className="flex items-center gap-2"><Check size={18} /> Actualizada</span>
                        ) : (
                          <span className="flex items-center gap-2">Actualizar Contraseña</span>
                        )}
                    </Button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl transform transition-all scale-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold font-display text-slate-800">Editar Alumno</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                <input 
                  className="w-full p-3 border border-slate-200 rounded-xl" 
                  value={editingUser.firstName} 
                  onChange={e => setEditingUser({...editingUser, firstName: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Apellido</label>
                <input 
                  className="w-full p-3 border border-slate-200 rounded-xl" 
                  value={editingUser.lastName} 
                  onChange={e => setEditingUser({...editingUser, lastName: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clase</label>
                <input 
                  className="w-full p-3 border border-slate-200 rounded-xl" 
                  value={editingUser.className} 
                  onChange={e => setEditingUser({...editingUser, className: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Puntos (XP)</label>
                <input 
                  type="number"
                  className="w-full p-3 border border-slate-200 rounded-xl" 
                  value={editingUser.points} 
                  onChange={e => setEditingUser({...editingUser, points: parseInt(e.target.value) || 0})} 
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  <Save size={18} /> Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
