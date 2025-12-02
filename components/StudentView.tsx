
import React, { useState, useRef, useEffect } from 'react';
import { User, Book, Transaction, Review, AppSettings } from '../types';
import { BookCard } from './BookCard';
import { Button } from './Button';
import { Trophy, Star, BookOpen, Search, Sparkles, User as UserIcon, MessageCircle, Send, X } from 'lucide-react';
import { chatWithLibrarian } from '../services/geminiService';

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
  const [activeTab, setActiveTab] = useState<'catalog' | 'mybooks' | 'ranking'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');
  
  // Review Modal State
  const [reviewingBook, setReviewingBook] = useState<Book | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // AI Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', sender: 'ai', text: `¡Hola ${currentUser.firstName}! Soy BiblioBot 🤖. ¿Buscas algún libro en especial hoy?` }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Helpers
  const getBookRating = (bookId: string) => {
    const bookReviews = reviews.filter(r => r.bookId === bookId);
    if (bookReviews.length === 0) return 0;
    const sum = bookReviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / bookReviews.length;
  };

  // Filter books
  const genres = ['Todos', ...Array.from(new Set(books.map(b => b.genre)))];
  const filteredBooks = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || b.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'Todos' || b.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  // Get my active books
  const myActiveTransactionIds = transactions
    .filter(t => t.userId === currentUser.id && t.active)
    .map(t => t.bookId);
    
  const myBooks = books.filter(b => myActiveTransactionIds.includes(b.id));

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
             <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain" />
             <div className="hidden sm:block">
                 <h1 className="font-display font-bold text-slate-800 text-lg leading-none">{settings.schoolName}</h1>
                 <p className="text-xs text-slate-400 font-medium">Biblioteca</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-brand-50 px-3 py-1.5 rounded-full">
               <div className="w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-bold border-2 border-brand-100">
                  {currentUser.firstName[0]}
               </div>
               <div className="flex flex-col">
                  <span className="font-bold text-xs text-slate-700 leading-none">{currentUser.firstName}</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-fun-orange">
                     <Star size={10} fill="currentColor" /> {currentUser.points} XP
                  </span>
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
        <div className="flex justify-center mb-6">
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 inline-flex">
            <button 
              onClick={() => setActiveTab('catalog')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'catalog' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
            >
              Catálogo
            </button>
            <button 
              onClick={() => setActiveTab('mybooks')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'mybooks' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
            >
              Mis Libros 
              {myBooks.length > 0 && <span className="bg-white text-brand-600 text-xs px-1.5 rounded-full">{myBooks.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('ranking')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ranking' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-brand-600'}`}
            >
              Ranking
            </button>
          </div>
        </div>

        {/* --- Catalog Tab --- */}
        {activeTab === 'catalog' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <input 
                  type="text" 
                  placeholder="Busca por título o autor..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
                />
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
                {genres.map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${selectedGenre === g ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredBooks.map(book => (
                <BookCard 
                  key={book.id} 
                  book={book} 
                  role={currentUser.role}
                  canBorrow={!myActiveTransactionIds.includes(book.id)}
                  onBorrow={onBorrow}
                  showShelf={true}
                  rating={getBookRating(book.id)}
                />
              ))}
              {filteredBooks.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-400">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-50"/>
                  <p>No se encontraron libros con esos filtros.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- My Books Tab --- */}
        {activeTab === 'mybooks' && (
           <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-800">Libros que estás leyendo</h2>
              {myBooks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {myBooks.map(book => (
                    <div key={book.id} className="flex flex-col h-full">
                       <BookCard 
                          book={book} 
                          role={currentUser.role}
                          canReturn={true}
                          onReturn={onReturn}
                          rating={getBookRating(book.id)}
                       />
                       <button 
                          onClick={() => setReviewingBook(book)}
                          className="mt-2 text-sm font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 py-2 rounded-xl w-full flex items-center justify-center gap-2 transition-colors"
                       >
                          <Star size={14} className="fill-brand-600" />
                          Opinar
                       </button>
                    </div>
                  ))}
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

        {/* --- Ranking Tab --- */}
        {activeTab === 'ranking' && (
           <div className="max-w-2xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                 <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center justify-center gap-3">
                   <Trophy className="text-fun-yellow w-10 h-10 drop-shadow-sm" fill="currentColor"/> 
                   Salón de la Fama
                 </h2>
                 <p className="text-slate-500">¡Sigue leyendo para escalar posiciones!</p>
              </div>

              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                 {users
                    .filter(u => u.role === 'STUDENT')
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 10)
                    .map((user, index) => {
                       let rankStyle = "text-slate-500";
                       let bgStyle = "hover:bg-slate-50";
                       let icon = null;

                       if (index === 0) {
                          rankStyle = "text-yellow-500 text-xl";
                          bgStyle = "bg-yellow-50/50 hover:bg-yellow-50";
                          icon = <Trophy size={20} fill="currentColor" className="text-yellow-400"/>;
                       } else if (index === 1) {
                          rankStyle = "text-slate-400 text-lg";
                          icon = <Trophy size={18} fill="currentColor" className="text-slate-300"/>;
                       } else if (index === 2) {
                          rankStyle = "text-orange-400 text-lg";
                          icon = <Trophy size={18} fill="currentColor" className="text-orange-300"/>;
                       }

                       return (
                          <div key={user.id} className={`flex items-center p-4 border-b border-slate-100 last:border-0 transition-colors ${bgStyle}`}>
                             <div className={`w-12 font-bold font-display text-center ${rankStyle}`}>
                                {index + 1}
                             </div>
                             <div className="flex-1 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                   {user.firstName[0]}
                                </div>
                                <div>
                                   <div className="font-bold text-slate-800 flex items-center gap-2">
                                      {user.firstName} {user.lastName}
                                      {icon}
                                   </div>
                                   <div className="text-xs text-slate-500 font-medium">{user.className}</div>
                                </div>
                             </div>
                             <div className="text-right">
                                <div className="font-bold text-brand-600">{user.points} XP</div>
                                <div className="text-xs text-slate-400">{user.booksRead} Libros</div>
                             </div>
                          </div>
                       );
                    })}
              </div>
           </div>
        )}

      </div>

      {/* --- REVIEW MODAL --- */}
      {reviewingBook && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
              <div className="text-center mb-6">
                 <h3 className="text-xl font-bold font-display text-slate-800">Opina sobre el libro</h3>
                 <p className="text-sm text-slate-500 mt-1">{reviewingBook.title}</p>
              </div>
              <form onSubmit={handleSubmitReview}>
                 <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map(star => (
                       <button 
                          key={star} 
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none transform hover:scale-110 transition-transform"
                       >
                          <Star 
                             size={32} 
                             className={star <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-slate-200 fill-slate-200"}
                          />
                       </button>
                    ))}
                 </div>
                 <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tu comentario</label>
                    <textarea 
                       className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                       rows={3}
                       placeholder="¿Qué te ha parecido?"
                       value={reviewComment}
                       onChange={e => setReviewComment(e.target.value)}
                       required
                    ></textarea>
                 </div>
                 <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setReviewingBook(null)}>Cancelar</Button>
                    <Button type="submit" className="flex-1">Enviar</Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* --- AI Chat Floating Button & Modal --- */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isChatOpen && (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white p-4 rounded-full shadow-lg shadow-violet-500/30 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 font-display font-bold animate-bounce-slow"
          >
            <Sparkles size={24} className="text-yellow-300" />
            <span className="hidden md:inline">BiblioBot</span>
          </button>
        )}
      </div>

      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm flex flex-col items-end">
           <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full overflow-hidden flex flex-col h-[500px]">
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-4 flex justify-between items-center text-white">
                 <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-2 rounded-full">
                       <Sparkles size={18} className="text-yellow-300"/>
                    </div>
                    <div>
                       <h3 className="font-bold font-display leading-none">BiblioBot</h3>
                       <p className="text-xs text-violet-100 opacity-90">Tu asistente lector</p>
                    </div>
                 </div>
                 <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors">
                    <X size={20} />
                 </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                 {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                          msg.sender === 'user' 
                             ? 'bg-brand-600 text-white rounded-tr-none' 
                             : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                       }`}>
                          {msg.text}
                       </div>
                    </div>
                 ))}
                 {isTyping && (
                    <div className="flex justify-start">
                       <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                       </div>
                    </div>
                 )}
                 <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                 <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Pregúntame algo sobre libros..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                 />
                 <button 
                    type="submit"
                    disabled={!chatInput.trim() || isTyping}
                    className="bg-violet-600 text-white p-2 rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                    <Send size={18} />
                 </button>
              </form>
           </div>
        </div>
      )}

    </div>
  );
};
