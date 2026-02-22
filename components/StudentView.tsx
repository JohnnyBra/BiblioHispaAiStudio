
import * as React from 'react';
import { User, Book, Transaction, Review, AppSettings } from '../types';
import { BookCard } from './BookCard';
import { Button } from './Button';
import { Trophy, Star, BookOpen, Search, Sparkles, User as UserIcon, MessageCircle, Send, X, TrendingUp, Heart, Calendar, FileText, Bookmark, Archive, LayoutGrid, List, ArrowUpDown, SlidersHorizontal, Clock, Sparkle, History, Award, ArrowLeft, Sun, Moon } from 'lucide-react';
import { chatWithLibrarian } from '../services/geminiService';
import { proxyCoverUrl } from '../services/utils';
import { getBookDetails, BookDetails } from '../services/bookService';
import { fetchBadges } from '../services/gamificationService';

interface StudentViewProps {
   currentUser: User;
   books: Book[];
   transactions: Transaction[];
   users: User[];
   reviews?: Review[];
   settings: AppSettings;
   onBorrow: (book: Book) => void;
   onReturn: (book: Book) => void;
   onLogout: () => void;
   onAddReview?: (review: Review) => void;
   theme?: 'dark' | 'light';
   toggleTheme?: () => void;
}

interface ChatMessage {
   id: string;
   sender: 'user' | 'ai';
   text: string;
}

export const StudentView: React.FC<StudentViewProps> = ({
   currentUser,
   books,
   transactions,
   users,
   reviews = [],
   settings,
   onBorrow,
   onReturn,
   onLogout,
   onAddReview,
   theme,
   toggleTheme
}) => {
   const [activeTab, setActiveTab] = React.useState<'catalog' | 'mybooks' | 'ranking' | 'history'>('catalog');
   const [searchTerm, setSearchTerm] = React.useState('');
   const [selectedGenre, setSelectedGenre] = React.useState<string>('Todos');
   const [selectedAge, setSelectedAge] = React.useState<string>('Todos');
   const [selectedShelf, setSelectedShelf] = React.useState<string>('Todos');

   // View & Sort State
   const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
   const [sortBy, setSortBy] = React.useState<'title' | 'author' | 'popularity' | 'rating'>('title');

   // Review Modal State
   const [reviewingBook, setReviewingBook] = React.useState<Book | null>(null);
   const [reviewRating, setReviewRating] = React.useState(5);
   const [reviewComment, setReviewComment] = React.useState('');

   // Details Modal State
   const [viewingBook, setViewingBook] = React.useState<Book | null>(null);
   const [bookDetails, setBookDetails] = React.useState<BookDetails | null>(null);
   const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);

   // AI Chat State
   const [isChatOpen, setIsChatOpen] = React.useState(false);
   const [chatInput, setChatInput] = React.useState('');
   const [isTyping, setIsTyping] = React.useState(false);
   const [messages, setMessages] = React.useState<ChatMessage[]>([
      { id: 'welcome', sender: 'ai', text: `¡Hola ${currentUser.firstName}! Soy BiblioBot 🤖. ¿Buscas algún libro en especial hoy?` }
   ]);
   const messagesEndRef = React.useRef<HTMLDivElement>(null);

   // Badges State
   const [badges, setBadges] = React.useState<any[]>([]);

   // Initial Data Fetch
   React.useEffect(() => {
      fetchBadges().then(setBadges).catch(console.error);
   }, []);

   // Scroll to bottom of chat
   React.useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
   }, [messages, isChatOpen]);

   // Helpers
   const getBookRating = (bookId: string) => {
      const bookReviews = reviews.filter(r => r.bookId === bookId);
      if (bookReviews.length === 0) return 0;
      const sum = bookReviews.reduce((acc, r) => acc + r.rating, 0);
      return sum / bookReviews.length;
   };

   // Helper to calculate earliest return date for out of stock books
   const getEarliestReturnDate = (bookId: string): string | undefined => {
      const LOAN_DURATION_DAYS = 15;
      const activeTxs = transactions.filter(t => t.bookId === bookId && t.active);

      if (activeTxs.length === 0) return undefined;

      const dates = activeTxs.map(t => {
         const borrowed = new Date(t.dateBorrowed);
         const due = new Date(borrowed);
         due.setDate(due.getDate() + LOAN_DURATION_DAYS);
         return due;
      });

      // Sort ascending to find the soonest
      dates.sort((a, b) => a.getTime() - b.getTime());

      return dates[0].toISOString();
   };

   // Filter & Sort books
   const genres = ['Todos', ...Array.from(new Set(books.map(b => b.genre)))];
   const ages = ['Todos', '0-5', '6-8', '9-11', '12-14', '+15']; // Standard age ranges
   const shelves = ['Todos', ...Array.from(new Set(books.map(b => b.shelf || 'Recepción'))).sort()];

   const filteredBooks = books
      .filter(b => {
         const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || b.author.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesGenre = selectedGenre === 'Todos' || b.genre === selectedGenre;
         const matchesAge = selectedAge === 'Todos' || (b.recommendedAge && b.recommendedAge.includes(selectedAge)) || !b.recommendedAge; // If no age set, show it to be safe
         const matchesShelf = selectedShelf === 'Todos' || (b.shelf || 'Recepción') === selectedShelf;
         return matchesSearch && matchesGenre && matchesAge && matchesShelf;
      })
      .sort((a, b) => {
         switch (sortBy) {
            case 'title': return a.title.localeCompare(b.title);
            case 'author': return a.author.localeCompare(b.author);
            case 'popularity': return b.readCount - a.readCount;
            case 'rating': return getBookRating(b.id) - getBookRating(a.id);
            default: return 0;
         }
      });

   // Get my active books
   const myActiveTransactionIds = transactions
      .filter(t => t.userId === currentUser.id && t.active)
      .map(t => t.bookId);

   const myBooks = books.filter(b => myActiveTransactionIds.includes(b.id));

   // Get my history
   const myHistoryTransactions = transactions
      .filter(t => t.userId === currentUser.id)
      .sort((a, b) => new Date(b.dateBorrowed).getTime() - new Date(a.dateBorrowed).getTime());

   // Handle Review Submission
   const handleSubmitReview = (e: React.FormEvent) => {
      e.preventDefault();
      if (reviewingBook && onAddReview) {
         onAddReview({
            id: `rev-${Date.now()}`,
            bookId: reviewingBook.id,
            userId: currentUser.id,
            authorName: `${currentUser.firstName} ${currentUser.lastName}`,
            rating: reviewRating,
            comment: reviewComment,
            date: new Date().toISOString()
         });
         setReviewingBook(null);
         setReviewRating(5);
         setReviewComment('');
      }
   };

   // Handle View Details
   const handleViewDetails = async (book: Book) => {
      setViewingBook(book);
      setBookDetails(null);

      // IF WE ALREADY HAVE THE DETAILS, USE THEM
      if (book.description) {
         setBookDetails({
            description: book.description,
            pages: book.pageCount,
            publisher: book.publisher,
            publishedDate: book.publishedDate,
            source: 'Local'
         });
         return;
      }

      setIsLoadingDetails(true);
      const details = await getBookDetails(book.title, book.author);
      setBookDetails(details);
      setIsLoadingDetails(false);
   };

   // Handle AI Chat
   const handleSendMessage = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!chatInput.trim()) return;

      const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text: chatInput };
      setMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsTyping(true);

      // Call API
      const responseText = await chatWithLibrarian(userMsg.text, "primaria/secundaria", books);

      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: responseText };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
   };

   return (
      <div className="min-h-screen pb-24 relative">
         {/* Top Bar */}
         <div className="glass-header">
            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <a href="https://prisma.bibliohispa.es"
                     className="flex items-center gap-2 p-2 md:px-4 md:py-2 glass-panel rounded-lg md:rounded-xl transition-all duration-200 font-semibold text-xs md:text-sm text-themed-secondary hover:bg-[var(--surface-raised)] hover:scale-[1.02] press-effect"
                     title="Ir al Portal Prisma">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <rect width="7" height="7" x="3" y="3" rx="1" />
                        <rect width="7" height="7" x="14" y="3" rx="1" fill="#3b82f6" stroke="#3b82f6" />
                        <rect width="7" height="7" x="14" y="14" rx="1" />
                        <rect width="7" height="7" x="3" y="14" rx="1" />
                     </svg>
                     <span className="hidden lg:inline">Prisma</span>
                  </a>
                  <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                  <div className="hidden sm:block">
                     <h1 className="font-display font-bold text-themed text-lg leading-none">{settings.schoolName}</h1>
                     <p className="text-[11px] text-themed-muted font-medium">Biblioteca</p>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 glass-panel px-4 py-2 rounded-2xl cursor-default group relative hover-glow">
                     <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-[var(--surface-base)] shadow-sm">
                        {currentUser.firstName[0]}
                     </div>
                     <div className="flex flex-col">
                        <span className="font-bold text-xs text-themed leading-none">{currentUser.firstName}</span>
                        <div className="flex items-center gap-2">
                           <span className="student-points-pill flex items-center gap-0.5 text-[10px] font-bold gradient-text">
                              <Star size={10} className="text-accent-amber" fill="currentColor" /> {currentUser.points} XP
                           </span>
                           {currentUser.currentStreak && currentUser.currentStreak > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent-coral" title="Racha actual">
                                 <TrendingUp size={10} /> {currentUser.currentStreak}
                              </span>
                           )}
                        </div>
                     </div>

                     {/* Badges Preview Tooltip/Dropdown */}
                     <div className="absolute top-full right-0 mt-2 w-64 glass-panel rounded-2xl shadow-glass-lg p-4 hidden group-hover:block z-50 animate-fade-in-down">
                        <h4 className="text-[10px] font-bold text-themed-muted uppercase mb-3 flex items-center gap-1"><Award size={12} /> Insignias</h4>
                        <div className="grid grid-cols-4 gap-2">
                           {currentUser.badges && currentUser.badges.length > 0 ? (
                              currentUser.badges.map(bId => {
                                 const badgeDef = badges.find(b => b.id === bId);
                                 if (!badgeDef) return null;
                                 return (
                                    <div key={bId} className="w-10 h-10 bg-[var(--surface-raised)] rounded-xl flex items-center justify-center text-xl border border-[var(--glass-border)] hover:scale-110 transition-transform" title={badgeDef.name + ': ' + badgeDef.description}>
                                       {badgeDef.icon}
                                    </div>
                                 );
                              })
                           ) : (
                              <p className="col-span-4 text-xs text-themed-muted">Aún no tienes insignias.</p>
                           )}
                        </div>
                     </div>
                  </div>
                  {toggleTheme && (
                     <button onClick={toggleTheme} className="theme-toggle" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                     </button>
                  )}
                  <Button variant="outline" size="sm" onClick={onLogout} className="border-[var(--glass-border)] hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 press-effect">
                     <span className="text-xs">Salir</span>
                  </Button>
               </div>
            </div>
         </div>

         <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

            {/* Navigation Tabs (Desktop) */}
            <div className="hidden md:flex justify-center mb-6 overflow-x-auto no-scrollbar mask-gradient-x">
               <div className="glass-panel p-1.5 rounded-2xl inline-flex whitespace-nowrap gap-1">
                  <button
                     onClick={() => setActiveTab('catalog')}
                     className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'catalog' ? 'bg-brand-500 text-white shadow-brand animate-tab-indicator' : 'text-themed-muted hover:text-brand-400 hover:bg-[var(--tab-inactive-hover)]'}`}
                  >
                     Catálogo
                  </button>
                  <button
                     onClick={() => setActiveTab('mybooks')}
                     className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'mybooks' ? 'bg-brand-500 text-white shadow-brand animate-tab-indicator' : 'text-themed-muted hover:text-brand-400 hover:bg-[var(--tab-inactive-hover)]'}`}
                  >
                     Mis Libros
                     {myBooks.length > 0 && <span className={`text-xs px-1.5 rounded-full font-bold ${activeTab === 'mybooks' ? 'bg-white/20 text-white' : 'bg-brand-500/15 text-brand-400'}`}>{myBooks.length}</span>}
                  </button>
                  <button
                     onClick={() => setActiveTab('history')}
                     className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'history' ? 'bg-brand-500 text-white shadow-brand animate-tab-indicator' : 'text-themed-muted hover:text-brand-400 hover:bg-[var(--tab-inactive-hover)]'}`}
                  >
                     Historial
                  </button>
                  <button
                     onClick={() => setActiveTab('ranking')}
                     className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'ranking' ? 'bg-brand-500 text-white shadow-brand animate-tab-indicator' : 'text-themed-muted hover:text-brand-400 hover:bg-[var(--tab-inactive-hover)]'}`}
                  >
                     Rankings
                  </button>
               </div>
            </div>

            {/* --- Catalog Tab --- */}
            {activeTab === 'catalog' && (
               <div className="space-y-6 animate-fade-in-up">
                  {/* Filters & View Control */}
                  <div className="flex flex-col gap-4">
                     <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="relative w-full md:w-96 group">
                           <input
                              type="text"
                              placeholder="Busca por título o autor..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input focus:outline-none text-themed text-sm placeholder:text-themed-muted"
                           />
                           <Search className="absolute left-3.5 top-4 text-themed-muted group-focus-within:text-brand-500 transition-colors duration-200" size={18} />
                        </div>

                        {/* Controls */}
                        <div className="flex gap-3 w-full md:w-auto">
                           <div className="flex items-center gap-2 glass-panel px-3 py-2.5 rounded-2xl flex-1 md:flex-none">
                              <ArrowUpDown size={15} className="text-themed-muted" />
                              <select
                                 className="bg-transparent text-sm font-medium text-themed-secondary outline-none w-full"
                                 value={sortBy}
                                 onChange={(e) => setSortBy(e.target.value as any)}
                              >
                                 <option value="title">Título (A-Z)</option>
                                 <option value="author">Autor (A-Z)</option>
                                 <option value="popularity">Más Populares</option>
                                 <option value="rating">Mejor Valorados</option>
                              </select>
                           </div>

                           <div className="glass-panel p-1 rounded-2xl flex gap-0.5">
                              <button
                                 onClick={() => setViewMode('grid')}
                                 className={`p-2.5 rounded-xl transition-all duration-200 ${viewMode === 'grid' ? 'bg-[var(--tab-active-bg)] text-brand-400 shadow-glass-sm' : 'text-themed-muted hover:text-themed-muted'}`}
                                 title="Vista Cuadrícula"
                              >
                                 <LayoutGrid size={18} />
                              </button>
                              <button
                                 onClick={() => setViewMode('list')}
                                 className={`p-2.5 rounded-xl transition-all duration-200 ${viewMode === 'list' ? 'bg-[var(--tab-active-bg)] text-brand-400 shadow-glass-sm' : 'text-themed-muted hover:text-themed-muted'}`}
                                 title="Vista Lista"
                              >
                                 <List size={18} />
                              </button>
                           </div>
                        </div>
                     </div>

                     {/* Filters Row */}
                     <div className="flex flex-col sm:flex-row gap-3">
                        {/* Genres */}
                        <div className="flex gap-2 overflow-x-auto pb-2 flex-1 no-scrollbar">
                           {genres.map(g => (
                              <button
                                 key={g}
                                 onClick={() => setSelectedGenre(g)}
                                 className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 press-effect ${selectedGenre === g ? 'bg-brand-600 text-white shadow-glass-sm' : 'glass-panel text-themed-muted hover:text-themed'}`}
                              >
                                 {g}
                              </button>
                           ))}
                        </div>

                        {/* Age Filter */}
                        <div className="flex items-center gap-2 glass-panel px-3 py-2 rounded-2xl flex-shrink-0">
                           <UserIcon size={15} className="text-accent-violet" />
                           <span className="text-[10px] font-bold text-themed-muted uppercase mr-1">Edad:</span>
                           <select
                              className="bg-transparent text-sm font-bold text-themed-secondary outline-none"
                              value={selectedAge}
                              onChange={(e) => setSelectedAge(e.target.value)}
                           >
                              {ages.map(age => (
                                 <option key={age} value={age}>{age}</option>
                              ))}
                           </select>
                        </div>

                        {/* Shelf Filter */}
                        <div className="flex items-center gap-2 glass-panel px-3 py-2 rounded-2xl flex-shrink-0">
                           <Archive size={15} className="text-brand-500" />
                           <span className="text-[10px] font-bold text-themed-muted uppercase mr-1">Espacio:</span>
                           <select
                              className="bg-transparent text-sm font-bold text-themed-secondary outline-none max-w-[150px]"
                              value={selectedShelf}
                              onChange={(e) => setSelectedShelf(e.target.value)}
                           >
                              {shelves.map(shelf => (
                                 <option key={shelf} value={shelf}>{shelf}</option>
                              ))}
                           </select>
                        </div>
                     </div>
                  </div>

                  {/* Content Display */}
                  {viewMode === 'grid' ? (
                     // GRID VIEW
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {filteredBooks.map((book, index) => (
                           <div key={book.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}>
                              <BookCard
                                 book={book}
                                 role={currentUser.role}
                                 canBorrow={!myActiveTransactionIds.includes(book.id)}
                                 onBorrow={onBorrow}
                                 onViewDetails={handleViewDetails}
                                 showShelf={true}
                                 rating={getBookRating(book.id)}
                                 earliestReturnDate={book.unitsAvailable <= 0 ? getEarliestReturnDate(book.id) : undefined}
                              />
                           </div>
                        ))}
                     </div>
                  ) : (
                     // LIST VIEW
                     <div className="space-y-4">
                        {filteredBooks.map(book => {
                           const isAvailable = book.unitsAvailable > 0;
                           const rating = getBookRating(book.id);
                           const canBorrow = !myActiveTransactionIds.includes(book.id);
                           const earliestReturn = !isAvailable ? getEarliestReturnDate(book.id) : undefined;
                           const formattedReturn = earliestReturn ? new Date(earliestReturn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : null;

                           return (
                              <div key={book.id} className="glass-card p-4 rounded-2xl flex gap-4 transition-all">
                                 {/* Image */}
                                 <div className="w-20 h-28 flex-shrink-0 bg-[var(--surface-raised)]/50 rounded-lg overflow-hidden relative shadow-sm">
                                    <img src={proxyCoverUrl(book.coverUrl)} className={`w-full h-full object-cover ${!isAvailable ? 'grayscale' : ''}`} alt={book.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    {!isAvailable && (
                                       <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                                          <span className="text-[10px] font-black text-white bg-red-500 px-1 py-0.5 rounded uppercase rotate-12 mb-1">Agotado</span>
                                          {formattedReturn && (
                                             <span className="text-[8px] text-white font-medium bg-black/50 px-1 rounded backdrop-blur">
                                                {formattedReturn}
                                             </span>
                                          )}
                                       </div>
                                    )}
                                 </div>

                                 {/* Info */}
                                 <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div>
                                       <div className="flex justify-between items-start">
                                          <h3 className="font-display font-bold text-lg text-themed truncate">{book.title}</h3>
                                          <div className="flex gap-1">
                                             <span className="text-xs font-bold text-brand-400 bg-brand-500/15 px-2 py-0.5 rounded whitespace-nowrap ml-2">{book.genre}</span>
                                             {book.recommendedAge && (
                                                <span className="text-[10px] font-bold text-fun-purple bg-purple-500/15 px-2 py-0.5 rounded whitespace-nowrap border border-purple-500/20">{book.recommendedAge}</span>
                                             )}
                                          </div>
                                       </div>
                                       <p className="text-sm text-themed-muted font-medium mb-1">{book.author}</p>

                                       <div className="flex items-center gap-4 text-xs text-themed-muted mt-2">
                                          <span className="flex items-center gap-1"><Archive size={14} /> {book.shelf}</span>
                                          <span className="flex items-center gap-1"><TrendingUp size={14} /> {book.readCount} lecturas</span>
                                          {rating > 0 && (
                                             <span className="flex items-center gap-1 text-yellow-500 font-bold"><Star size={14} fill="currentColor" /> {rating.toFixed(1)}</span>
                                          )}
                                       </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--divider)]">
                                       <span className={`text-xs font-bold ${isAvailable ? 'text-green-600' : 'text-red-500'}`}>
                                          {isAvailable ? 'Disponible' : 'Sin stock'} ({book.unitsAvailable}/{book.unitsTotal})
                                       </span>

                                       <div className="flex gap-2">
                                          <Button size="sm" variant="secondary" onClick={() => handleViewDetails(book)} className="text-xs px-3 py-1.5 h-auto">
                                             Ver Detalles
                                          </Button>
                                          {canBorrow && isAvailable && (
                                             <Button size="sm" onClick={() => onBorrow(book)} className="text-xs px-3 py-1.5 h-auto">
                                                Sacar
                                             </Button>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}

                  {filteredBooks.length === 0 && (
                     <div className="col-span-full flex flex-col items-center justify-center py-20 animate-fade-in">
                        <div className="w-24 h-24 bg-[var(--surface-raised)]/80 rounded-3xl flex items-center justify-center mb-6">
                           <BookOpen size={40} className="text-themed-muted" />
                        </div>
                        <h3 className="font-display font-bold text-xl text-themed mb-2">Sin resultados</h3>
                        <p className="text-themed-muted text-sm max-w-xs text-center">No encontramos libros con esos filtros. Prueba a cambiar la búsqueda.</p>
                     </div>
                  )}
               </div>
            )}

            {/* --- My Books Tab --- */}
            {activeTab === 'mybooks' && (
               <div className="space-y-6 animate-fade-in-up">
                  <h2 className="text-2xl font-display font-bold text-themed">Libros que estás leyendo</h2>
                  {myBooks.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {myBooks.map(book => {
                           // Calculate loan duration for visual cues
                           const tx = transactions.find(t => t.bookId === book.id && t.userId === currentUser.id && t.active);
                           const dateBorrowed = tx ? new Date(tx.dateBorrowed) : new Date();
                           const daysHeld = Math.floor((Date.now() - dateBorrowed.getTime()) / (1000 * 60 * 60 * 24));
                           const isNew = daysHeld < 2; // Less than 2 days
                           const isLongLoan = daysHeld > 14; // More than 2 weeks

                           return (
                              <div key={book.id} className={`flex flex-col h-full rounded-3xl p-2 transition-all duration-500 ${isNew ? 'bg-green-500/10 ring-2 ring-fun-green ring-offset-2' : ''} ${isLongLoan ? 'bg-red-500/10 ring-2 ring-fun-orange ring-offset-2' : ''}`}>

                                 {/* Visual Cues */}
                                 <div className="relative">
                                    {isNew && (
                                       <div className="absolute -top-3 -right-2 z-10 bg-fun-green text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-bounce-slow">
                                          <Sparkle size={10} fill="currentColor" /> ¡NUEVO!
                                       </div>
                                    )}
                                    {isLongLoan && (
                                       <div className="absolute -top-3 -right-2 z-10 bg-fun-orange text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                                          <Clock size={10} /> +2 semanas
                                       </div>
                                    )}

                                    <BookCard
                                       book={book}
                                       role={currentUser.role}
                                       canReturn={true}
                                       onReturn={onReturn}
                                       onViewDetails={handleViewDetails}
                                       rating={getBookRating(book.id)}
                                    />
                                 </div>

                                 <button
                                    onClick={() => setReviewingBook(book)}
                                    className="mt-2 text-sm font-bold text-brand-400 bg-[var(--surface-raised)] border border-[var(--glass-border)] hover:bg-[var(--tab-active-bg)] py-2 rounded-xl w-full flex items-center justify-center gap-2 transition-colors shadow-sm"
                                 >
                                    <Star size={14} className="fill-brand-600" />
                                    Opinar
                                 </button>
                              </div>
                           );
                        })}
                     </div>
                  ) : (
                     <div className="glass-panel rounded-3xl p-12 text-center animate-fade-in">
                        <div className="w-24 h-24 bg-[var(--surface-raised)]/80 rounded-3xl flex items-center justify-center mx-auto mb-6">
                           <BookOpen size={40} className="text-themed-muted" />
                        </div>
                        <h3 className="text-xl font-display font-bold text-themed mb-2">No tienes libros prestados</h3>
                        <p className="text-themed-muted text-sm mb-8">¡Ve al catálogo y elige tu próxima aventura!</p>
                        <Button onClick={() => setActiveTab('catalog')}>Ir al Catálogo</Button>
                     </div>
                  )}
               </div>
            )}

            {/* --- History Tab --- */}
            {activeTab === 'history' && (
               <div className="space-y-6 animate-fade-in-up">
                  <h2 className="text-2xl font-display font-bold text-themed flex items-center gap-2">
                     <History size={24} className="text-themed-muted" />
                     Historial de Lecturas
                  </h2>
                  {myHistoryTransactions.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myHistoryTransactions.map(tx => {
                           const book = books.find(b => b.id === tx.bookId);
                           if (!book) return null; // Should not happen

                           return (
                              <div key={tx.id} className={`glass-card p-4 rounded-2xl flex gap-4 items-center transition-all ${tx.active ? 'ring-2 ring-brand-500/30 bg-brand-500/10' : 'opacity-80 hover:opacity-100'}`}>
                                 <div className="w-14 h-20 flex-shrink-0 bg-[var(--surface-raised)]/50 rounded-lg overflow-hidden shadow-sm">
                                    {book.coverUrl ? (
                                       <img src={proxyCoverUrl(book.coverUrl)} className="w-full h-full object-cover" alt="cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    ) : (
                                       <div className="w-full h-full bg-[var(--surface-raised)] flex items-center justify-center text-[10px] p-1 text-center font-bold text-themed-muted">{book.title}</div>
                                    )}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-themed text-sm truncate">{book.title}</h4>
                                    <p className="text-xs text-themed-muted truncate mb-2">{book.author}</p>

                                    <div className="space-y-1">
                                       <div className="flex items-center gap-2 text-[10px]">
                                          <span className="bg-green-500/15 text-green-400 font-bold px-1.5 py-0.5 rounded">Sacado:</span>
                                          <span className="text-themed-secondary font-mono">{new Date(tx.dateBorrowed).toLocaleDateString()}</span>
                                       </div>
                                       {tx.active ? (
                                          <div className="flex items-center gap-2 text-[10px]">
                                             <span className="bg-brand-500/15 text-brand-300 font-bold px-1.5 py-0.5 rounded animate-pulse">Leyendo...</span>
                                          </div>
                                       ) : (
                                          <div className="flex items-center gap-2 text-[10px]">
                                             <span className="bg-[var(--surface-raised)] text-themed-muted font-bold px-1.5 py-0.5 rounded">Devuelto:</span>
                                             <span className="text-themed-secondary font-mono">{tx.dateReturned ? new Date(tx.dateReturned).toLocaleDateString() : '-'}</span>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  ) : (
                     <div className="glass-panel rounded-3xl p-12 text-center animate-fade-in">
                        <div className="w-24 h-24 bg-[var(--surface-raised)]/80 rounded-3xl flex items-center justify-center mx-auto mb-6">
                           <History size={40} className="text-themed-muted" />
                        </div>
                        <h3 className="font-display font-bold text-xl text-themed mb-2">Sin historial</h3>
                        <p className="text-themed-muted text-sm">Aún no has sacado ningún libro. ¡Tu historia empieza hoy!</p>
                     </div>
                  )}
               </div>
            )}

            {/* --- Ranking Tab --- */}
            {activeTab === 'ranking' && (
               <div className="space-y-8 animate-fade-in-up">
                  <div className="text-center space-y-2 mb-8">
                     <h2 className="text-3xl font-display font-bold text-themed flex items-center justify-center gap-3">
                        <Trophy className="text-accent-amber w-10 h-10 drop-shadow-sm" fill="currentColor" />
                        Salón de la Fama
                     </h2>
                     <p className="text-themed-muted text-sm">¡Descubre quién lee más y cuáles son los mejores libros!</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                     {/* COL 1: TOP STUDENTS */}
                     <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
                        <div className="bg-brand-500/10 backdrop-blur-sm p-4 border-b border-brand-500/20 flex items-center gap-2">
                           <Trophy size={20} className="text-brand-400" />
                           <h3 className="font-bold text-brand-300">Superlectores</h3>
                        </div>
                        {users
                           .filter(u => u.role === 'STUDENT')
                           .sort((a, b) => b.points - a.points)
                           .slice(0, 5)
                           .map((user, index) => {
                              let rankStyle = "text-themed-muted";
                              let bgStyle = "hover:bg-[var(--surface-raised)]";
                              let icon = null;

                              if (index === 0) {
                                 rankStyle = "text-yellow-500 text-xl";
                                 bgStyle = "bg-yellow-500/10 hover:bg-yellow-500/15";
                                 icon = <Trophy size={16} fill="currentColor" className="text-yellow-400" />;
                              } else if (index === 1) {
                                 rankStyle = "text-themed-muted text-lg";
                                 icon = <Trophy size={14} fill="currentColor" className="text-themed-muted" />;
                              } else if (index === 2) {
                                 rankStyle = "text-orange-400 text-lg";
                                 icon = <Trophy size={14} fill="currentColor" className="text-orange-300" />;
                              }

                              return (
                                 <div key={user.id} className={`flex items-center p-4 border-b border-[var(--glass-border)] last:border-0 transition-colors animate-fade-in-up stagger-${index + 1} ${bgStyle} ${index === 0 ? 'animate-rainbow-glow' : ''}`}>
                                    <div className={`w-8 font-bold font-display text-center ${rankStyle}`}>
                                       {index + 1}
                                    </div>
                                    <div className="flex-1 flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-full bg-[var(--surface-raised)] flex items-center justify-center text-themed-secondary font-bold text-xs">
                                          {user.firstName[0]}
                                       </div>
                                       <div className="min-w-0">
                                          <div className="font-bold text-themed text-sm flex items-center gap-1 truncate">
                                             {user.firstName} {user.lastName}
                                             {icon}
                                          </div>
                                          <div className="text-[10px] text-themed-muted font-medium">{user.className}</div>
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="font-bold text-brand-400 text-sm">{user.points} XP</div>
                                    </div>
                                 </div>
                              );
                           })}
                        {users.filter(u => u.role === 'STUDENT').length === 0 && (
                           <div className="p-8 text-center text-themed-muted text-sm">Aún no hay alumnos.</div>
                        )}
                     </div>

                     {/* COL 2: TOP BORROWED BOOKS */}
                     <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
                        <div className="bg-fun-green/10 p-4 border-b border-fun-green/20 flex items-center gap-2">
                           <TrendingUp size={20} className="text-fun-green" />
                           <h3 className="font-bold text-green-300">Más Leídos</h3>
                        </div>
                        {[...books]
                           .sort((a, b) => b.readCount - a.readCount)
                           .slice(0, 5)
                           .map((book, index) => (
                              <div key={book.id} className="flex items-center p-3 border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--surface-raised)] transition-colors">
                                 <div className="w-8 font-bold text-themed-muted text-center mr-2">{index + 1}</div>
                                 <img src={proxyCoverUrl(book.coverUrl)} className="w-10 h-14 object-cover rounded shadow-sm bg-[var(--surface-raised)]" alt="cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                 <div className="flex-1 ml-3 min-w-0">
                                    <h4 className="font-bold text-themed text-sm truncate" title={book.title}>{book.title}</h4>
                                    <p className="text-xs text-themed-muted">{book.readCount} lecturas</p>
                                 </div>
                              </div>
                           ))}
                        {books.length === 0 && <div className="p-8 text-center text-themed-muted text-sm">No hay datos.</div>}
                     </div>

                     {/* COL 3: TOP RATED BOOKS */}
                     <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
                        <div className="bg-fun-purple/10 p-4 border-b border-fun-purple/20 flex items-center gap-2">
                           <Heart size={20} className="text-fun-purple" />
                           <h3 className="font-bold text-purple-300">Mejores Valorados</h3>
                        </div>
                        {[...books]
                           .filter(b => getBookRating(b.id) > 0)
                           .sort((a, b) => getBookRating(b.id) - getBookRating(a.id))
                           .slice(0, 5)
                           .map((book, index) => (
                              <div key={book.id} className="flex items-center p-3 border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--surface-raised)] transition-colors">
                                 <div className="w-8 font-bold text-themed-muted text-center mr-2">{index + 1}</div>
                                 <img src={proxyCoverUrl(book.coverUrl)} className="w-10 h-14 object-cover rounded shadow-sm bg-[var(--surface-raised)]" alt="cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                 <div className="flex-1 ml-3 min-w-0">
                                    <h4 className="font-bold text-themed text-sm truncate" title={book.title}>{book.title}</h4>
                                    <div className="flex items-center gap-1">
                                       <Star size={10} className="text-yellow-400 fill-yellow-400" />
                                       <span className="text-xs font-bold text-themed-secondary">{getBookRating(book.id).toFixed(1)}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        {books.filter(b => getBookRating(b.id) > 0).length === 0 && <div className="p-8 text-center text-themed-muted text-sm">Aún no hay valoraciones.</div>}
                     </div>
                  </div>
               </div>
            )}

         </div>

         {/* --- FLOATING CHAT WIDGET --- */}
         <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isChatOpen && (
               <div className="glass-panel rounded-3xl shadow-glass-xl w-80 sm:w-96 mb-4 overflow-hidden flex flex-col animate-slide-up origin-bottom-right h-[500px]">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-brand-600 to-brand-700 p-4 flex justify-between items-center text-white">
                     <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                           <Sparkles size={16} />
                        </div>
                        <div>
                           <h3 className="font-display font-bold text-sm">BiblioChat</h3>
                           <p className="text-[10px] text-white/70">Tu bibliotecario virtual</p>
                        </div>
                     </div>
                     <button onClick={() => setIsChatOpen(false)} className="hover:bg-[var(--surface-raised)] p-1.5 rounded-xl transition-colors">
                        <X size={18} />
                     </button>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--surface-raised)]/80">
                     {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                           <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${msg.sender === 'user'
                                 ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-tr-sm shadow-brand'
                                 : 'glass-card text-themed shadow-glass-sm rounded-tl-sm border border-[var(--glass-border)]'
                              }`}>
                              {msg.text}
                           </div>
                        </div>
                     ))}
                     {isTyping && (
                        <div className="flex justify-start animate-fade-in">
                           <div className="glass-card text-themed-muted shadow-glass-sm rounded-2xl rounded-tl-sm p-3 text-xs border border-[var(--glass-border)] flex gap-1">
                              <span className="animate-bounce">●</span>
                              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                           </div>
                        </div>
                     )}
                     <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <form onSubmit={handleSendMessage} className="p-3 bg-[var(--glass-bg-heavy)] border-t border-[var(--glass-border)] flex gap-2">
                     <input
                        type="text"
                        className="flex-1 glass-input rounded-xl px-3 py-2.5 text-sm focus:outline-none text-themed"
                        placeholder="Escribe aquí..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                     />
                     <button
                        type="submit"
                        disabled={!chatInput.trim() || isTyping}
                        className="bg-gradient-to-b from-brand-500 to-brand-600 text-white p-2.5 rounded-xl hover:from-brand-500 hover:to-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-brand press-effect"
                     >
                        <Send size={18} />
                     </button>
                  </form>
               </div>
            )}

            {/* Trigger Button */}
            <button
               onClick={() => setIsChatOpen(!isChatOpen)}
               className={`${isChatOpen ? 'bg-brand-600' : 'bg-gradient-to-b from-brand-500 to-brand-600 animate-bounce-slow shadow-brand-lg'} text-white p-4 rounded-2xl shadow-glass-lg hover:shadow-glass-xl transition-all duration-300 hover:scale-105 flex items-center gap-2 press-effect`}
            >
               {isChatOpen ? <X size={24} /> : <MessageCircle size={26} />}
               {!isChatOpen && <span className="font-display font-bold pr-1 text-sm">¡Pregúntame!</span>}
            </button>
         </div>

         {/* --- BOOK DETAILS MODAL --- */}
         {viewingBook && (
            <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="modal-glass rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-glass-xl flex flex-col md:flex-row overflow-hidden relative animate-modal-in">
                  <button
                     onClick={() => setViewingBook(null)}
                     className="absolute top-4 right-4 z-10 glass-panel hover:bg-[var(--surface-raised)] p-2 rounded-xl shadow-glass-sm transition-all press-effect"
                  >
                     <X size={18} className="text-themed-muted" />
                  </button>

                  <div className="w-full md:w-1/3 h-64 md:h-auto relative bg-[var(--surface-raised)]">
                     <img src={proxyCoverUrl(viewingBook.coverUrl)} className="w-full h-full object-cover" alt={viewingBook.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col justify-end p-4">
                        <span className="text-white font-bold bg-brand-500 px-2 py-0.5 rounded text-xs self-start mb-2 shadow-sm">{viewingBook.genre}</span>
                        {viewingBook.recommendedAge && (
                           <span className="text-white font-bold bg-fun-purple px-2 py-0.5 rounded text-xs self-start shadow-sm border border-white/20">Edad: {viewingBook.recommendedAge}</span>
                        )}
                     </div>
                  </div>

                  <div className="p-8 md:w-2/3 space-y-4">
                     <div>
                        <h2 className="text-2xl font-display font-bold text-themed leading-tight mb-1">{viewingBook.title}</h2>
                        <p className="text-themed-muted font-medium">{viewingBook.author}</p>
                     </div>

                     <div className="flex gap-4 border-y border-[var(--glass-border)] py-3">
                        <div className="flex flex-col">
                           <span className="text-[10px] uppercase font-bold text-themed-muted">Estante</span>
                           <span className="text-sm font-bold text-themed flex items-center gap-1"><Archive size={14} /> {viewingBook.shelf}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] uppercase font-bold text-themed-muted">Ejemplares</span>
                           <span className={`text-sm font-bold flex items-center gap-1 ${viewingBook.unitsAvailable > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              <BookOpen size={14} /> {viewingBook.unitsAvailable}/{viewingBook.unitsTotal}
                           </span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] uppercase font-bold text-themed-muted">Páginas</span>
                           <span className="text-sm font-bold text-themed flex items-center gap-1">
                              <FileText size={14} /> {isLoadingDetails ? '...' : bookDetails?.pages || '?'}
                           </span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] uppercase font-bold text-themed-muted">Publicado</span>
                           <span className="text-sm font-bold text-themed flex items-center gap-1">
                              <Calendar size={14} /> {isLoadingDetails ? '...' : bookDetails?.publishedDate?.split('-')[0] || '?'}
                           </span>
                        </div>
                     </div>

                     <div>
                        <h3 className="text-sm font-bold text-themed uppercase mb-2">Sinopsis</h3>
                        {isLoadingDetails ? (
                           <div className="space-y-2 animate-pulse">
                              <div className="h-2 bg-[var(--surface-raised)] rounded w-full"></div>
                              <div className="h-2 bg-[var(--surface-raised)] rounded w-5/6"></div>
                              <div className="h-2 bg-[var(--surface-raised)] rounded w-4/6"></div>
                           </div>
                        ) : (
                           <p className="text-sm text-themed-secondary leading-relaxed max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                              {bookDetails?.description || "No hay descripción disponible."}
                           </p>
                        )}
                     </div>

                     <div className="pt-4 mt-auto">
                        {/* If it's available, show borrow button, otherwise show stock */}
                        {viewingBook.unitsAvailable > 0 && !myActiveTransactionIds.includes(viewingBook.id) ? (
                           <Button className="w-full" onClick={() => { onBorrow(viewingBook); setViewingBook(null); }}>
                              <Bookmark size={18} /> ¡Quiero leerlo!
                           </Button>
                        ) : (
                           <div className="text-center text-sm font-bold text-themed-muted bg-[var(--surface-raised)] p-3 rounded-xl border border-[var(--glass-border)]">
                              {myActiveTransactionIds.includes(viewingBook.id) ? 'Ya tienes este libro' : 'No disponible para préstamo'}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* --- REVIEW MODAL --- */}
         {reviewingBook && (
            <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4 animate-fade-in">
               <div className="modal-glass rounded-3xl w-full max-w-md p-8 shadow-glass-xl relative animate-modal-in">
                  <button
                     onClick={() => setReviewingBook(null)}
                     className="absolute top-4 right-4 text-themed-muted hover:text-themed-muted transition-colors p-1 rounded-xl hover:bg-[var(--surface-raised)]"
                  >
                     <X size={22} />
                  </button>

                  <div className="text-center mb-6">
                     <div className="w-16 h-24 mx-auto mb-3 rounded-lg overflow-hidden shadow-sm bg-[var(--surface-raised)]">
                        <img src={proxyCoverUrl(reviewingBook.coverUrl)} className="w-full h-full object-cover" alt="cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                     </div>
                     <h3 className="font-bold text-lg text-themed leading-tight">{reviewingBook.title}</h3>
                     <p className="text-sm text-themed-muted">¿Qué te ha parecido?</p>
                  </div>

                  <form onSubmit={handleSubmitReview} className="space-y-4">
                     <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                           <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className="transform transition-transform hover:scale-110 focus:outline-none"
                           >
                              <Star
                                 size={32}
                                 className={star <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-[var(--text-muted)] fill-[var(--text-muted)]"}
                              />
                           </button>
                        ))}
                     </div>

                     <textarea
                        className="w-full p-3 bg-[var(--surface-raised)] border border-[var(--glass-border)] rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none text-themed"
                        rows={4}
                        placeholder="Escribe tu opinión aquí... (Opcional)"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                     />

                     <Button type="submit" className="w-full">
                        Enviar Opinión
                     </Button>
                  </form>
               </div>
            </div>
         )}

         {/* Mobile Bottom Navigation */}
         <div className="md:hidden fixed bottom-0 left-0 right-0 glass-bottom-nav p-2 pb-safe flex justify-around items-center z-40">
            <button
               onClick={() => setActiveTab('catalog')}
               className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'catalog' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
            >
               <LayoutGrid size={22} strokeWidth={activeTab === 'catalog' ? 2.5 : 1.5} />
               <span className="text-[10px] font-bold mt-0.5">Catálogo</span>
            </button>
            <button
               onClick={() => setActiveTab('mybooks')}
               className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 relative press-effect ${activeTab === 'mybooks' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
            >
               <div className="relative">
                  <BookOpen size={22} strokeWidth={activeTab === 'mybooks' ? 2.5 : 1.5} />
                  {myBooks.length > 0 && (
                     <span className="absolute -top-1 -right-1.5 bg-brand-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-[var(--surface-base)]">
                        {myBooks.length}
                     </span>
                  )}
               </div>
               <span className="text-[10px] font-bold mt-0.5">Mis Libros</span>
            </button>
            <button
               onClick={() => setActiveTab('history')}
               className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'history' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
            >
               <Clock size={22} strokeWidth={activeTab === 'history' ? 2.5 : 1.5} />
               <span className="text-[10px] font-bold mt-0.5">Historial</span>
            </button>
            <button
               onClick={() => setActiveTab('ranking')}
               className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 w-16 press-effect ${activeTab === 'ranking' ? 'text-brand-400 tab-active-dot' : 'text-themed-muted'}`}
            >
               <Trophy size={22} strokeWidth={activeTab === 'ranking' ? 2.5 : 1.5} />
               <span className="text-[10px] font-bold mt-0.5">Rankings</span>
            </button>
         </div>
      </div>
   );
};
