import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const toastStyles: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-bg-secondary',
    border: 'border-success',
    icon: <CheckCircle size={20} className="text-success" />,
  },
  error: {
    bg: 'bg-bg-secondary',
    border: 'border-error',
    icon: <XCircle size={20} className="text-error" />,
  },
  warning: {
    bg: 'bg-bg-secondary',
    border: 'border-warning',
    icon: <AlertTriangle size={20} className="text-warning" />,
  },
  info: {
    bg: 'bg-bg-secondary',
    border: 'border-info',
    icon: <Info size={20} className="text-info" />,
  },
};

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  description,
  duration = 3000,
  onClose,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const style = toastStyles[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300); // Match animation duration
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3',
        'p-4 min-w-[320px] max-w-[420px]',
        style.bg,
        'border',
        style.border,
        'rounded-lg',
        'shadow-lg',
        isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
      )}
      role="alert"
    >
      <span className="flex-shrink-0 mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{message}</p>
        {description && <p className="text-xs text-text-secondary mt-1">{description}</p>}
      </div>
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 text-text-tertiary hover:text-text-primary transition-colors"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};

// Toast Container for managing multiple toasts
export interface ToastContainerProps {
  toasts: Array<Omit<ToastProps, 'onClose'>>;
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-24 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
};

// Custom hook for managing toasts
export interface UseToastOptions {
  defaultDuration?: number;
}

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

export const useToast = (options: UseToastOptions = {}) => {
  const { defaultDuration = 3000 } = options;
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (type: ToastType, message: string, description?: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastData = {
      id,
      type,
      message,
      description,
      duration: duration ?? defaultDuration,
    };
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (message: string, description?: string, duration?: number) =>
    addToast('success', message, description, duration);

  const error = (message: string, description?: string, duration?: number) =>
    addToast('error', message, description, duration);

  const warning = (message: string, description?: string, duration?: number) =>
    addToast('warning', message, description, duration);

  const info = (message: string, description?: string, duration?: number) =>
    addToast('info', message, description, duration);

  const clear = () => setToasts([]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    clear,
    ToastContainer: () => <ToastContainer toasts={toasts} onClose={removeToast} />,
  };
};

export default Toast;
