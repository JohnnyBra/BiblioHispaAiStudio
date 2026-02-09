
import * as React from 'react';
import { Book, UserRole } from '../types';
import { Button } from './Button';
import { BookOpen, Star, Archive, Eye, Clock, User } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onBorrow?: (book: Book) => void;
  onReturn?: (book: Book) => void;
  onViewDetails?: (book: Book) => void;
  canBorrow?: boolean;
  canReturn?: boolean;
  role: UserRole;
  showShelf?: boolean;
  rating?: number; // 0-5
  earliestReturnDate?: string; // ISO String
}

// Generate a deterministic color gradient based on string input
const getCoverGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const gradients = [
        'from-red-500 to-orange-500',
        'from-rose-500 to-pink-500',
        'from-fuchsia-500 to-purple-500',
        'from-violet-500 to-indigo-500',
        'from-blue-500 to-cyan-500',
        'from-teal-500 to-emerald-500',
        'from-green-500 to-lime-500',
        'from-amber-500 to-yellow-500',
        'from-slate-600 to-slate-800'
    ];
    return gradients[Math.abs(hash) % gradients.length];
};

export const BookCard: React.FC<BookCardProps> = ({ 
  book, 
  onBorrow, 
  onReturn,
  onViewDetails, 
  canBorrow, 
  canReturn,
  role,
  showShelf = false,
  rating = 0,
  earliestReturnDate
}) => {
  // Determine card border based on availability
  const isAvailable = book.unitsAvailable > 0;
  
  // Format date if available
  const formattedReturnDate = earliestReturnDate 
    ? new Date(earliestReturnDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) 
    : null;

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full group">
      <div className="relative h-48 overflow-hidden bg-slate-100/50">
        {book.coverUrl ? (
            <img 
            src={book.coverUrl} 
            alt={book.title}
            className={`w-full h-full object-cover transform transition-transform duration-700 ease-in-out group-hover:scale-110 ${!isAvailable ? 'grayscale' : ''}`}
            loading="lazy"
            />
        ) : (
            // CSS GENERATED COVER (Fallback)
            <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book.title)} p-4 flex flex-col justify-center items-center text-center group-hover:scale-110 transition-transform duration-700`}>
                 <div className="border-2 border-white/30 p-4 w-full h-full flex flex-col justify-center rounded-lg backdrop-blur-sm">
                    <BookOpen size={24} className="text-white/50 mx-auto mb-2"/>
                    <h3 className="font-display font-bold text-white text-lg leading-tight line-clamp-3 drop-shadow-md">{book.title}</h3>
                    <p className="text-white/80 text-xs mt-2 font-medium truncate">{book.author}</p>
                 </div>
            </div>
        )}
        
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1 z-10">
           <Star size={12} className="text-fun-yellow fill-fun-yellow"/> {book.readCount} leídos
        </div>
        {!isAvailable && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px] flex flex-col items-center justify-center z-20 p-4 text-center">
            <span className="text-white font-display font-black text-2xl tracking-widest bg-fun-red px-6 py-2 rounded-2xl transform -rotate-12 border-4 border-white shadow-2xl uppercase mb-3">
              AGOTADO
            </span>
            {formattedReturnDate && (
               <div className="flex flex-col items-center animate-pulse">
                  <span className="text-slate-300 text-[10px] font-bold uppercase tracking-wider">Disponible aprox.</span>
                  <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white font-bold text-sm mt-1 border border-white/30">
                     <Clock size={14} />
                     {formattedReturnDate}
                  </div>
               </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow bg-white/30 backdrop-blur-sm">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex gap-1 flex-wrap">
             <span className="text-xs font-bold text-brand-600 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded-md">
               {book.genre}
             </span>
             {book.recommendedAge && (
               <span className="text-xs font-bold text-fun-purple uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                  <User size={10} /> {book.recommendedAge}
               </span>
             )}
          </div>
          {showShelf && (
            <span className="text-xs text-slate-500 flex items-center gap-1 whitespace-nowrap">
              <Archive size={12}/> {book.shelf}
            </span>
          )}
        </div>
        
        <h3 className="font-display font-bold text-lg text-slate-800 leading-tight mb-1 line-clamp-2">{book.title}</h3>
        <p className="text-sm text-slate-500 mb-2">{book.author}</p>
        
        {/* Rating Stars */}
        <div className="flex items-center gap-0.5 mb-3">
           {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                 key={star} 
                 size={14} 
                 className={star <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-slate-200 fill-slate-200"}
              />
           ))}
           {rating > 0 && <span className="text-xs text-slate-400 ml-1">({rating.toFixed(1)})</span>}
        </div>
        
        <div className="mt-auto pt-3 border-t border-slate-100">
          <div className="flex justify-between items-center mb-3">
             <span className={`text-sm font-medium ${isAvailable ? 'text-fun-green' : 'text-fun-red font-bold'}`}>
               {isAvailable ? `${book.unitsAvailable} de ${book.unitsTotal} disp.` : 'Sin unidades'}
             </span>
          </div>

          <div className="space-y-2">
             <div className="flex gap-2">
               {canBorrow && onBorrow && (
                 <Button 
                   onClick={() => onBorrow(book)} 
                   disabled={!isAvailable}
                   className="w-full"
                   size="sm"
                   variant={isAvailable ? 'primary' : 'outline'}
                 >
                   {isAvailable ? 'Sacar' : 'No disponible'}
                 </Button>
               )}
               {canReturn && onReturn && (
                 <Button 
                   onClick={() => onReturn(book)} 
                   className="w-full"
                   size="sm"
                   variant="success"
                 >
                   Devolver
                 </Button>
               )}
             </div>
             
             {onViewDetails && (
               <Button 
                  onClick={() => onViewDetails(book)}
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
               >
                 <Eye size={14} className="mr-1" /> Ver Detalles
               </Button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
