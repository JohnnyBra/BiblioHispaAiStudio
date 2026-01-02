
import * as React from 'react';
import { User, Book, Transaction, Review, AppSettings } from '../types';
import { BookCard } from './BookCard';
import { Button } from './Button';
import { Trophy, Star, BookOpen, Search, Sparkles, User as UserIcon, MessageCircle, Send, X, TrendingUp, Heart, Calendar, FileText, Bookmark, Archive, LayoutGrid, List, ArrowUpDown, SlidersHorizontal, Clock, Sparkle, History, Award, ArrowLeft } from 'lucide-react';
import { chatWithLibrarian } from '../services/geminiService';
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
  onAddReview
}) => {
  const [activeTab, setActiveTab] = React.useState<'catalog' | 'mybooks' | 'ranking' | 'history'>('catalog');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedGenre, setSelectedGenre] = React.useState<string>('Todos');
  const [selectedAge, setSelectedAge] = React.useState<string>('Todos');
  const [selectedShelf, setSelectedShelf] = React.useState<string>('Todas');
  
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
  const shelves = ['Todas', ...Array.from(new Set(books.map(b => b.shelf || 'Recepción'))).sort()];

  const filteredBooks = books
    .filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || b.author.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGenre = selectedGenre === 'Todos' || b.genre === selectedGenre;
      const matchesAge = selectedAge === 'Todos' || (b.recommendedAge && b.recommendedAge.includes(selectedAge)) || !b.recommendedAge; // If no age set, show it to be safe
      const matchesShelf = selectedShelf === 'Todas' || (b.shelf || 'Recepción') === selectedShelf;
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
    <div className="min-h-screen pb-20 relative">
      {/* Top Bar */}
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <a href="https://prisma.bibliohispa.es/" className="mr-2 text-slate-400 hover:text-brand-600 transition-colors" title="Volver a Prisma">
                <ArrowLeft size={24} />
             </a>
             <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain" />
             <div className="hidden sm:block">
                 <h1 className="font-display font-bold text-slate-800 text-lg leading-none">{settings.schoolName}</h1>
                 <p className="text-xs text-slate-400 font-medium">Biblioteca</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-brand-50 px-3 py-1.5 rounded-full transition-all hover:bg-brand-100 cursor-default group relative">
               <div className="w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-bold border-2 border-brand-100">
                  {currentUser.firstName[0]}
               </div>
               <div className="flex flex-col">
                  <span className="font-bold text-xs text-slate-700 leading-none">{currentUser.firstName}</span>
                  <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-fun-orange">
                         <Star size={10} fill="currentColor" /> {currentUser.points} XP
                      </span>
                      {currentUser.currentStreak && currentUser.currentStreak > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500" title="Racha actual">
                             <TrendingUp size={10} /> {currentUser.currentStreak} días
                          </span>
                      )}
                  </div>
               </div>

               {/* Badges Preview Tooltip/Dropdown */}
               <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-4 hidden group-hover:block z-50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Award size={12}/> Insignias</h4>
                  <div className="grid grid-cols-4 gap-2">
                     {currentUser.badges && currentUser.badges.length > 0 ? (
                        currentUser.badges.map(bId => {
                           const badgeDef = badges.find(b => b.id === bId);
                           if (!badgeDef) return null;
                           return (
                              <div key={bId} className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-xl border border-slate-200" title={badgeDef.name + ': ' + badgeDef.description}>
                                 {badgeDef.icon}
                              </div>
                           );
                        })
                     ) : (
                        <p className="col-span-4 text-xs text-slate-400">Aún no tienes insignias.</p>
                     )}
                  </div>
               </div>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout} className="border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500">
               <span className="text-xs">Salir</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-6 overflow-x-auto no-scrollbar">
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 inline-flex whitespace-nowrap">
            <button 
              onClick={() => setActiveTab('catalog')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'catalog' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
            >
              Catálogo
            </button>
            <button 
              onClick={() => setActiveTab('mybooks')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'mybooks' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
            >
              Mis Libros 
              {myBooks.length > 0 && <span className="bg-white text-brand-600 text-xs px-1.5 rounded-full">{myBooks.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
            >
              Historial
            </button>
            <button 
              onClick={() => setActiveTab('ranking')}
              className={`px-4 sm:px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ranking' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
            >
              Rankings
            </button>
          </div>
        </div>

        {/* --- Catalog Tab --- */}
        {activeTab === 'catalog' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filters & View Control */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:w-96">
                  <input 
                    type="text" 
                    placeholder="Busca por título o autor..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm bg-white text-slate-900"
                  />
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                </div>
                
                {/* Controls */}
                <div className="flex gap-4 w-full md:w-auto">
                   <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 md:flex-none">
                      <ArrowUpDown size={16} className="text-slate-400"/>
                      <select 
                        className="bg-transparent text-sm font-medium text-slate-600 outline-none w-full"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                      >
                         <option value="title">Título (A-Z)</option>
                         <option value="author">Autor (A-Z)</option>
                         <option value="popularity">Más Populares</option>
                         <option value="rating">Mejor Valorados</option>
                      </select>
                   </div>
                   
                   <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200">
                      <button 
                         onClick={() => setViewMode('grid')} 
                         className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                         title="Vista Cuadrícula"
                      >
                         <LayoutGrid size={20}/>
                      </button>
                      <button 
                         onClick={() => setViewMode('list')} 
                         className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                         title="Vista Lista"
                      >
                         <List size={20}/>
                      </button>
                   </div>
                </div>
              </div>

              {/* Filters Row */}
              <div className="flex flex-col sm:flex-row gap-4">
                  {/* Genres */}
                  <div className="flex gap-2 overflow-x-auto pb-2 flex-1 no-scrollbar">
                    {genres.map(g => (
                      <button
                        key={g}
                        onClick={() => setSelectedGenre(g)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${selectedGenre === g ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  
                  {/* Age Filter */}
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                      <UserIcon size={16} className="text-fun-purple"/>
                      <span className="text-xs font-bold text-slate-400 uppercase mr-1">Edad:</span>
                      <select 
                        className="bg-transparent text-sm font-bold text-slate-600 outline-none"
                        value={selectedAge}
                        onChange={(e) => setSelectedAge(e.target.value)}
                      >
                         {ages.map(age => (
                            <option key={age} value={age}>{age}</option>
                         ))}
                      </select>
                   </div>

                  {/* Shelf Filter */}
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                      <Archive size={16} className="text-brand-500"/>
                      <span className="text-xs font-bold text-slate-400 uppercase mr-1">Estantería:</span>
                      <select
                        className="bg-transparent text-sm font-bold text-slate-600 outline-none max-w-[150px]"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredBooks.map(book => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    role={currentUser.role}
                    canBorrow={!myActiveTransactionIds.includes(book.id)}
                    onBorrow={onBorrow}
                    onViewDetails={handleViewDetails}
                    showShelf={true}
                    rating={getBookRating(book.id)}
                    earliestReturnDate={book.unitsAvailable <= 0 ? getEarliestReturnDate(book.id) : undefined}
                  />
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
                    const formattedReturn = earliestReturn ? new Date(earliestReturn).toLocaleDateString('es-ES', {day: 'numeric', month: 'short'}) : null;

                    return (
                       <div key={book.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 hover:shadow-md transition-shadow">
                          {/* Image */}
                          <div className="w-20 h-28 flex-shrink-0 bg-slate-200 rounded-lg overflow-hidden relative">
                             <img src={book.coverUrl} className={`w-full h-full object-cover ${!isAvailable ? 'grayscale' : ''}`} alt={book.title}/>
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
                                   <h3 className="font-display font-bold text-lg text-slate-800 truncate">{book.title}</h3>
                                   <div className="flex gap-1">
                                      <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded whitespace-nowrap ml-2">{book.genre}</span>
                                      {book.recommendedAge && (
                                         <span className="text-[10px] font-bold text-fun-purple bg-purple-50 px-2 py-0.5 rounded whitespace-nowrap border border-purple-100">{book.recommendedAge}</span>
                                      )}
                                   </div>
                                </div>
                                <p className="text-sm text-slate-500 font-medium mb-1">{book.author}</p>
                                
                                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                                   <span className="flex items-center gap-1"><Archive size={14}/> {book.shelf}</span>
                                   <span className="flex items-center gap-1"><TrendingUp size={14}/> {book.readCount} lecturas</span>
                                   {rating > 0 && (
                                      <span className="flex items-center gap-1 text-yellow-500 font-bold"><Star size={14} fill="currentColor"/> {rating.toFixed(1)}</span>
                                   )}
                                </div>
                             </div>

                             <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-50">
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
              <div className="col-span-full text-center py-20 text-slate-400">
                <BookOpen size={48} className="mx-auto mb-4 opacity-50"/>
                <p>No se encontraron libros con esos filtros.</p>
              </div>
            )}
          </div>
        )}

        {/* --- My Books Tab --- */}
        {activeTab === 'mybooks' && (
           <div className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-slate-800">Libros que estás leyendo</h2>
              {myBooks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {myBooks.map(book => {
                     // Calculate loan duration for visual cues
                     const tx = transactions.find(t => t.bookId === book.id && t.userId === currentUser.id && t.active);
                     const dateBorrowed = tx ? new Date(tx.dateBorrowed) : new Date();
                     const daysHeld = Math.floor((Date.now() - dateBorrowed.getTime()) / (1000 * 60 * 60 * 24));
                     const isNew = daysHeld < 2; // Less than 2 days
                     const isLongLoan = daysHeld > 14; // More than 2 weeks

                     return (
                        <div key={book.id} className={`flex flex-col h-full rounded-3xl p-2 transition-all duration-500 ${isNew ? 'bg-green-50/50 ring-2 ring-fun-green ring-offset-2' : ''} ${isLongLoan ? 'bg-red-50/50 ring-2 ring-fun-orange ring-offset-2' : ''}`}>
                           
                           {/* Visual Cues */}
                           <div className="relative">
                              {isNew && (
                                 <div className="absolute -top-3 -right-2 z-10 bg-fun-green text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-bounce-slow">
                                    <Sparkle size={10} fill="currentColor"/> ¡NUEVO!
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
                              className="mt-2 text-sm font-bold text-brand-600 bg-white border border-brand-100 hover:bg-brand-50 py-2 rounded-xl w-full flex items-center justify-center gap-2 transition-colors shadow-sm"
                           >
                              <Star size={14} className="fill-brand-600" />
                              Opinar
                           </button>
                        </div>
                     );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-slate-100">
                   <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <BookOpen size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-slate-700 mb-2">No tienes libros prestados</h3>
                   <p className="text-slate-500 mb-6">¡Ve al catálogo y elige tu próxima aventura!</p>
                   <Button onClick={() => setActiveTab('catalog')}>Ir al Catálogo</Button>
                </div>
              )}
           </div>
        )}

        {/* --- History Tab --- */}
        {activeTab === 'history' && (
           <div className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                 <History size={24} className="text-slate-400"/>
                 Historial de Lecturas
              </h2>
              {myHistoryTransactions.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myHistoryTransactions.map(tx => {
                       const book = books.find(b => b.id === tx.bookId);
                       if (!book) return null; // Should not happen

                       return (
                          <div key={tx.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-center transition-all hover:shadow-md ${tx.active ? 'ring-2 ring-brand-100' : 'opacity-80 hover:opacity-100'}`}>
                             <div className="w-14 h-20 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                                {book.coverUrl ? (
                                   <img src={book.coverUrl} className="w-full h-full object-cover" alt="cover"/>
                                ) : (
                                   <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] p-1 text-center font-bold text-slate-400">{book.title}</div>
                                )}
                             </div>
                             <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 text-sm truncate">{book.title}</h4>
                                <p className="text-xs text-slate-500 truncate mb-2">{book.author}</p>
                                
                                <div className="space-y-1">
                                   <div className="flex items-center gap-2 text-[10px]">
                                      <span className="bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded">Sacado:</span>
                                      <span className="text-slate-600 font-mono">{new Date(tx.dateBorrowed).toLocaleDateString()}</span>
                                   </div>
                                   {tx.active ? (
                                      <div className="flex items-center gap-2 text-[10px]">
                                         <span className="bg-brand-50 text-brand-700 font-bold px-1.5 py-0.5 rounded animate-pulse">Leyendo...</span>
                                      </div>
                                   ) : (
                                      <div className="flex items-center gap-2 text-[10px]">
                                         <span className="bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">Devuelto:</span>
                                         <span className="text-slate-600 font-mono">{tx.dateReturned ? new Date(tx.dateReturned).toLocaleDateString() : '-'}</span>
                                      </div>
                                   )}
                                </div>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              ) : (
                 <div className="p-10 text-center text-slate-400 bg-white rounded-3xl border border-slate-100">
                    <History size={48} className="mx-auto mb-4 opacity-50"/>
                    <p>Aún no has sacado ningún libro. ¡Tu historia empieza hoy!</p>
                 </div>
              )}
           </div>
        )}

        {/* --- Ranking Tab --- */}
        {activeTab === 'ranking' && (
           <div className="space-y-8 animate-fade-in">
              <div className="text-center space-y-2 mb-8">
                 <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center justify-center gap-3">
                   <Trophy className="text-fun-yellow w-10 h-10 drop-shadow-sm" fill="currentColor"/> 
                   Salón de la Fama
                 </h2>
                 <p className="text-slate-500">¡Descubre quién lee más y cuáles son los mejores libros!</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  
                  {/* COL 1: TOP STUDENTS */}
                  <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                      <div className="bg-brand-50 p-4 border-b border-brand-100 flex items-center gap-2">
                          <Trophy size={20} className="text-brand-600" />
                          <h3 className="font-bold text-brand-800">Superlectores</h3>
                      </div>
                     {users
                        .filter(u => u.role === 'STUDENT')
                        .sort((a, b) => b.points - a.points)
                        .slice(0, 5)
                        .map((user, index) => {
                           let rankStyle = "text-slate-500";
                           let bgStyle = "hover:bg-slate-50";
                           let icon = null;

                           if (index === 0) {
                              rankStyle = "text-yellow-500 text-xl";
                              bgStyle = "bg-yellow-50/50 hover:bg-yellow-50";
                              icon = <Trophy size={16} fill="currentColor" className="text-yellow-400"/>;
                           } else if (index === 1) {
                              rankStyle = "text-slate-400 text-lg";
                              icon = <Trophy size={14} fill="currentColor" className="text-slate-300"/>;
                           } else if (index === 2) {
                              rankStyle = "text-orange-400 text-lg";
                              icon = <Trophy size={14} fill="currentColor" className="text-orange-300"/>;
                           }

                           return (
                              <div key={user.id} className={`flex items-center p-4 border-b border-slate-100 last:border-0 transition-colors ${bgStyle}`}>
                                 <div className={`w-8 font-bold font-display text-center ${rankStyle}`}>
                                    {index + 1}
                                 </div>
                                 <div className="flex-1 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                       {user.firstName[0]}
                                    </div>
                                    <div className="min-w-0">
                                       <div className="font-bold text-slate-800 text-sm flex items-center gap-1 truncate">
                                          {user.firstName} {user.lastName}
                                          {icon}
                                       </div>
                                       <div className="text-[10px] text-slate-500 font-medium">{user.className}</div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="font-bold text-brand-600 text-sm">{user.points} XP</div>
                                 </div>
                              </div>
                           );
                        })}
                        {users.filter(u => u.role === 'STUDENT').length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm">Aún no hay alumnos.</div>
                        )}
                  </div>

                  {/* COL 2: TOP BORROWED BOOKS */}
                  <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                      <div className="bg-fun-green/10 p-4 border-b border-fun-green/20 flex items-center gap-2">
                          <TrendingUp size={20} className="text-fun-green" />
                          <h3 className="font-bold text-green-800">Más Leídos</h3>
                      </div>
                      {[...books]
                         .sort((a, b) => b.readCount - a.readCount)
                         .slice(0, 5)
                         .map((book, index) => (
                            <div key={book.id} className="flex items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                <div className="w-8 font-bold text-slate-300 text-center mr-2">{index + 1}</div>
                                <img src={book.coverUrl} className="w-10 h-14 object-cover rounded shadow-sm bg-slate-200" alt="cover"/>
                                <div className="flex-1 ml-3 min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate" title={book.title}>{book.title}</h4>
                                    <p className="text-xs text-slate-500">{book.readCount} lecturas</p>
                                </div>
                            </div>
                         ))}
                         {books.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No hay datos.</div>}
                  </div>

                  {/* COL 3: TOP RATED BOOKS */}
                  <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                      <div className="bg-fun-purple/10 p-4 border-b border-fun-purple/20 flex items-center gap-2">
                          <Heart size={20} className="text-fun-purple" />
                          <h3 className="font-bold text-purple-800">Mejores Valorados</h3>
                      </div>
                      {[...books]
                         .filter(b => getBookRating(b.id) > 0)
                         .sort((a, b) => getBookRating(b.id) - getBookRating(a.id))
                         .slice(0, 5)
                         .map((book, index) => (
                            <div key={book.id} className="flex items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                <div className="w-8 font-bold text-slate-300 text-center mr-2">{index + 1}</div>
                                <img src={book.coverUrl} className="w-10 h-14 object-cover rounded shadow-sm bg-slate-200" alt="cover"/>
                                <div className="flex-1 ml-3 min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate" title={book.title}>{book.title}</h4>
                                    <div className="flex items-center gap-1">
                                        <Star size={10} className="text-yellow-400 fill-yellow-400"/>
                                        <span className="text-xs font-bold text-slate-600">{getBookRating(book.id).toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                         ))}
                         {books.filter(b => getBookRating(b.id) > 0).length === 0 && <div className="p-8 text-center text-slate-400 text-sm">Aún no hay valoraciones.</div>}
                  </div>
              </div>
           </div>
        )}

      </div>

      {/* --- FLOATING CHAT WIDGET --- */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
         {/* Chat Window */}
         {isChatOpen && (
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 sm:w-96 mb-4 overflow-hidden flex flex-col animate-scale-in origin-bottom-right h-[500px]">
               {/* Header */}
               <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Sparkles size={16} />
                     </div>
                     <div>
                        <h3 className="font-bold text-sm">BiblioChat</h3>
                        <p className="text-[10px] opacity-80">Tu bibliotecario virtual</p>
                     </div>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-1 rounded-lg">
                     <X size={18} />
                  </button>
               </div>
               
               {/* Messages Area */}
               <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {messages.map((msg) => (
                     <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                           msg.sender === 'user' 
                              ? 'bg-brand-500 text-white rounded-tr-none' 
                              : 'bg-white text-slate-700 shadow-sm rounded-tl-none border border-slate-100'
                        }`}>
                           {msg.text}
                        </div>
                     </div>
                  ))}
                  {isTyping && (
                     <div className="flex justify-start">
                        <div className="bg-white text-slate-400 shadow-sm rounded-2xl rounded-tl-none p-3 text-xs border border-slate-100 flex gap-1">
                           <span className="animate-bounce">●</span>
                           <span className="animate-bounce delay-100">●</span>
                           <span className="animate-bounce delay-200">●</span>
                        </div>
                     </div>
                  )}
                  <div ref={messagesEndRef} />
               </div>

               {/* Input Area */}
               <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                  <input 
                     type="text" 
                     className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-900"
                     placeholder="Escribe aquí..."
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button 
                     type="submit" 
                     disabled={!chatInput.trim() || isTyping}
                     className="bg-brand-600 text-white p-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                     <Send size={18} />
                  </button>
               </form>
            </div>
         )}

         {/* Trigger Button */}
         <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`${isChatOpen ? 'bg-slate-700' : 'bg-brand-600 animate-bounce-slow'} text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center gap-2`}
         >
            {isChatOpen ? <X size={24} /> : <MessageCircle size={28} />}
            {!isChatOpen && <span className="font-bold pr-2">¡Pregúntame!</span>}
         </button>
      </div>

      {/* --- BOOK DETAILS MODAL --- */}
      {viewingBook && (
         <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
               <button 
                  onClick={() => setViewingBook(null)}
                  className="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white p-2 rounded-full shadow-sm backdrop-blur transition-all"
               >
                  <X size={20} className="text-slate-500"/>
               </button>

               <div className="w-full md:w-1/3 h-64 md:h-auto relative bg-slate-100">
                  <img src={viewingBook.coverUrl} className="w-full h-full object-cover" alt={viewingBook.title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex flex-col justify-end p-4">
                     <span className="text-white font-bold bg-brand-500 px-2 py-0.5 rounded text-xs self-start mb-2 shadow-sm">{viewingBook.genre}</span>
                     {viewingBook.recommendedAge && (
                        <span className="text-white font-bold bg-fun-purple px-2 py-0.5 rounded text-xs self-start shadow-sm border border-white/20">Edad: {viewingBook.recommendedAge}</span>
                     )}
                  </div>
               </div>

               <div className="p-8 md:w-2/3 space-y-4">
                  <div>
                     <h2 className="text-2xl font-display font-bold text-slate-800 leading-tight mb-1">{viewingBook.title}</h2>
                     <p className="text-slate-500 font-medium">{viewingBook.author}</p>
                  </div>

                  <div className="flex gap-4 border-y border-slate-100 py-3">
                     <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Estante</span>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1"><Archive size={14}/> {viewingBook.shelf}</span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Páginas</span>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                           <FileText size={14}/> {isLoadingDetails ? '...' : bookDetails?.pages || '?'}
                        </span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Publicado</span>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                           <Calendar size={14}/> {isLoadingDetails ? '...' : bookDetails?.publishedDate?.split('-')[0] || '?'}
                        </span>
                     </div>
                  </div>

                  <div>
                     <h3 className="text-sm font-bold text-slate-700 uppercase mb-2">Sinopsis</h3>
                     {isLoadingDetails ? (
                        <div className="space-y-2 animate-pulse">
                           <div className="h-2 bg-slate-100 rounded w-full"></div>
                           <div className="h-2 bg-slate-100 rounded w-5/6"></div>
                           <div className="h-2 bg-slate-100 rounded w-4/6"></div>
                        </div>
                     ) : (
                        <p className="text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto pr-2 custom-scrollbar">
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
                         <div className="text-center text-sm font-bold text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
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
         <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
               <button 
                  onClick={() => setReviewingBook(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
               >
                  <X size={24} />
               </button>
               
               <div className="text-center mb-6">
                  <div className="w-16 h-24 mx-auto mb-3 rounded-lg overflow-hidden shadow-sm bg-slate-100">
                     <img src={reviewingBook.coverUrl} className="w-full h-full object-cover" alt="cover"/>
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 leading-tight">{reviewingBook.title}</h3>
                  <p className="text-sm text-slate-500">¿Qué te ha parecido?</p>
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
                              className={star <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 fill-slate-200"}
                           />
                        </button>
                     ))}
                  </div>
                  
                  <textarea 
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none text-slate-900"
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
    </div>
  );
};
