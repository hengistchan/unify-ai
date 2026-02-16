import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  error: 'bg-error-muted text-error',
  info: 'bg-info-muted text-info',
  default: 'bg-bg-tertiary text-text-secondary',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center',
        'px-2 py-0.5',
        'text-xs font-medium',
        'rounded-full',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
