
import React from 'react';
import { Book, UserRole } from '../types';
import { Button } from './Button';
import { BookOpen, Star, Archive } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onBorrow?: (book: Book) => void;
  onReturn?: (book: Book) => void;
  canBorrow?: boolean;
  canReturn?: boolean;
  role: UserRole;
  showShelf?: boolean;
  rating?: number; // 0-5
}

export const BookCard: React.FC<BookCardProps> = ({ 
  book, 
  onBorrow, 
  onReturn, 
  canBorrow, 
  canReturn,
  role,
  showShelf = false,
  rating = 0
}) => {
  // Determine card border based on availability
  const isAvailable = book.unitsAvailable > 0;
  
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full group">
      <div className="relative h-48 overflow-hidden bg-slate-200">
        <img 
          src={book.coverUrl || `https://picsum.photos/seed/${book.id}/400/600`} 
          alt={book.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1">
           <Star size={12} className="text-fun-yellow fill-fun-yellow"/> {book.readCount} leídos
        </div>
        {!isAvailable && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
            <span className="text-white font-bold bg-fun-red px-3 py-1 rounded-full transform -rotate-12 border-2 border-white">AGOTADO</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded-md">
            {book.genre}
          </span>
          {showShelf && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
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
             <span className={`text-sm font-medium ${isAvailable ? 'text-fun-green' : 'text-fun-red'}`}>
               {book.unitsAvailable} de {book.unitsTotal} disp.
             </span>
          </div>

          <div className="flex gap-2">
            {canBorrow && onBorrow && (
              <Button 
                onClick={() => onBorrow(book)} 
                disabled={!isAvailable}
                className="w-full"
                size="sm"
                variant={isAvailable ? 'primary' : 'outline'}
              >
                {isAvailable ? 'Sacar libro' : 'No disponible'}
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
        </div>
      </div>
    </div>
  );
};
