
import * as React from 'react';
import { Book, UserRole } from '../types';
import { Button } from './Button';
import { BookOpen, Star, Archive, Eye, Clock, User } from 'lucide-react';
import { proxyCoverUrl } from '../services/utils';

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
    <div className="glass-card rounded-3xl overflow-hidden flex flex-col h-full group hover-glow">
      <div className="relative h-52 overflow-hidden bg-slate-100/50">
        {book.coverUrl ? (
            <img
            src={proxyCoverUrl(book.coverUrl)}
            alt={book.title}
            className={`w-full h-full object-cover transform transition-transform duration-700 ease-in-out will-change-transform group-hover:scale-105 ${!isAvailable ? 'grayscale' : ''}`}
            loading="lazy"
            />
        ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book.title)} p-4 flex flex-col justify-center items-center text-center group-hover:scale-105 transition-transform duration-700 will-change-transform`}>
                 <div className="border-2 border-white/30 p-4 w-full h-full flex flex-col justify-center rounded-xl backdrop-blur-sm">
                    <BookOpen size={24} className="text-white/50 mx-auto mb-2"/>
                    <h3 className="font-display font-bold text-white text-lg leading-tight line-clamp-3 drop-shadow-md">{book.title}</h3>
                    <p className="text-white/80 text-xs mt-2 font-medium truncate">{book.author}</p>
                 </div>
            </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/15 to-transparent pointer-events-none z-[5]"></div>

        <div className="absolute top-3 right-3 glass-panel !bg-white/90 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-600 flex items-center gap-1 z-10 shadow-glass-sm">
           <Star size={11} className="text-accent-amber fill-accent-amber"/> {book.readCount}
        </div>
        {!isAvailable && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[3px] flex flex-col items-center justify-center z-20 p-4 text-center">
            <span className="text-white/90 font-display font-bold text-sm tracking-wider uppercase bg-white/10 px-5 py-2.5 rounded-full border border-white/20 backdrop-blur-md shadow-lg">
              No disponible
            </span>
            {formattedReturnDate && (
               <div className="flex flex-col items-center mt-3">
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full text-white/90 font-medium text-xs border border-white/20">
                     <Clock size={13} />
                     Aprox. {formattedReturnDate}
                  </div>
               </div>
            )}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow bg-white/30 backdrop-blur-sm">
        <div className="flex justify-between items-start mb-2.5 gap-2">
          <div className="flex gap-1.5 flex-wrap">
             <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wide bg-brand-50 px-2.5 py-1 rounded-full">
               {book.genre}
             </span>
             {book.recommendedAge && (
               <span className="text-[10px] font-bold text-accent-violet uppercase tracking-wide bg-purple-50 px-2.5 py-1 rounded-full flex items-center gap-0.5">
                  <User size={10} /> {book.recommendedAge}
               </span>
             )}
          </div>
          {showShelf && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1 whitespace-nowrap">
              <Archive size={12}/> {book.shelf}
            </span>
          )}
        </div>

        <h3 className="font-display font-bold text-lg text-slate-800 leading-tight mb-1 line-clamp-2">{book.title}</h3>
        <p className="text-sm text-slate-400 mb-2.5">{book.author}</p>

        <div className="flex items-center gap-0.5 mb-3">
           {[1, 2, 3, 4, 5].map((star) => (
              <Star
                 key={star}
                 size={14}
                 className={star <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-slate-200/60 fill-slate-200/60"}
              />
           ))}
           {rating > 0 && <span className="text-[11px] text-slate-400 ml-1">({rating.toFixed(1)})</span>}
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100/50">
          <div className="flex justify-between items-center mb-3">
             <span className={`text-sm font-medium ${isAvailable ? 'text-accent-emerald' : 'text-accent-coral font-bold'}`}>
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
