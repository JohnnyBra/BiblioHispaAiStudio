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
    success: "glass-panel !bg-white/95 border-l-4 border-accent-emerald text-slate-800",
    error: "glass-panel !bg-white/95 border-l-4 border-accent-coral text-slate-800",
    info: "glass-panel !bg-white/95 border-l-4 border-brand-500 text-slate-800"
  };

  const icons = {
    success: <CheckCircle className="text-accent-emerald" size={20} />,
    error: <AlertCircle className="text-accent-coral" size={20} />,
    info: <Info className="text-brand-500" size={20} />
  };

  return (
    <div className={`${variants[toast.type]} rounded-2xl p-4 flex items-center gap-3 min-w-[300px] max-w-md transform animate-toast-in hover:scale-[1.02] transition-transform duration-200`}>
      <div className="flex-shrink-0">
        {icons[toast.type]}
      </div>
      <p className="flex-1 text-sm font-medium font-sans">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100/50"
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
    <div className="fixed top-4 right-4 sm:bottom-6 sm:right-6 sm:top-auto z-[60] flex flex-col gap-3 pointer-events-none w-full sm:w-auto px-4 sm:px-0">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  );
};