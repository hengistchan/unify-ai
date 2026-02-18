import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, icon, iconPosition = 'left', fullWidth = false, className, id, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || `input-${generatedId}`;
    const hasError = Boolean(error);

    return (
      <div className={cn(fullWidth && 'w-full', className)}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-primary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === 'left' && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 16 })
                : icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full',
              'px-3 py-2.5',
              icon && iconPosition === 'left' && 'pl-9',
              icon && iconPosition === 'right' && 'pr-9',
              'bg-bg-tertiary',
              'border rounded-md',
              'text-sm text-text-primary',
              'placeholder:text-text-tertiary',
              'transition-all duration-fast ease-out',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-border-focus',
              hasError
                ? 'border-error focus:ring-error focus:border-error'
                : 'border-border hover:border-border-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 16 })
                : icon}
            </span>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <AlertCircle size={14} className="text-error flex-shrink-0" />
            <p className="text-xs text-error">{error}</p>
          </div>
        )}
        {hint && !error && <p className="text-xs text-text-tertiary mt-1.5">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
