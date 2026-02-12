import * as React from 'react';
import '../types';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading,
  className = '',
  disabled,
  ...props 
}) => {
  const baseStyle = "font-display font-semibold rounded-2xl transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 select-none";

  const variants = {
    primary: "bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-700 text-white shadow-brand hover:shadow-brand-lg",
    secondary: "bg-[var(--surface-raised)] hover:bg-[var(--surface-overlay)] text-themed shadow-glass-sm hover:shadow-glass border border-[var(--glass-border)]",
    danger: "bg-gradient-to-b from-red-500 to-red-600 hover:from-red-500 hover:to-red-700 text-white shadow-danger",
    success: "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-success",
    outline: "border-[1.5px] border-[var(--glass-border)] hover:border-brand-400 hover:text-brand-400 hover:bg-brand-500/10 text-themed-secondary bg-[var(--glass-bg)] backdrop-blur-sm"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : children}
    </button>
  );
};