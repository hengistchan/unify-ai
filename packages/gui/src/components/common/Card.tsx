import React from 'react';
import { cn } from '@/lib/utils';
import { Badge, BadgeVariant } from './Badge';

// Card Header
export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant?: BadgeVariant;
  };
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  badge,
  action,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-3 p-4', 'border-b border-border', className)}>
      {icon && <span className="flex-shrink-0 text-primary">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-text-primary truncate">{title}</h3>
          {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
        </div>
        {subtitle && <p className="text-xs text-text-tertiary mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

// Card Body
export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, className }) => {
  return <div className={cn('p-4', className)}>{children}</div>;
};

// Card Footer
export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 px-4',
        'bg-bg-tertiary',
        'border-t border-border',
        'rounded-b-lg',
        className
      )}
    >
      {children}
    </div>
  );
};

// Card
export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
} = ({ children, className, hoverable = true, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-bg-secondary',
        'border border-border',
        'rounded-lg',
        'overflow-hidden',
        'transition-all duration-normal ease-out',
        hoverable && 'hover:border-border-hover hover:shadow-md hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
