import React from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import '../types';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000); // Auto close after 4 seconds

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const variants = {
    success: "bg-white border-l-4 border-fun-green text-slate-800",
    error: "bg-white border-l-4 border-fun-red text-slate-800",
    info: "bg-white border-l-4 border-brand-500 text-slate-800"
  };

  const icons = {
    success: <CheckCircle className="text-fun-green" size={20} />,
    error: <AlertCircle className="text-fun-red" size={20} />,
    info: <Info className="text-brand-500" size={20} />
  };

  return (
    <div className={`${variants[toast.type]} shadow-lg rounded-r-xl p-4 flex items-center gap-3 min-w-[300px] max-w-md transform transition-all duration-300 animate-[slideInRight_0.3s_ease-out] hover:scale-[1.02]`}>
      <div className="flex-shrink-0">
        {icons[toast.type]}
      </div>
      <p className="flex-1 text-sm font-medium font-sans">{toast.message}</p>
      <button 
        onClick={() => onClose(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
      >
        <X size={16} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  );
};