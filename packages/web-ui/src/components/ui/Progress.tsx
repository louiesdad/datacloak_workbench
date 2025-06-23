import React from 'react';
import { clsx } from 'clsx';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({ 
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showValue = false,
  className,
  ...props 
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const containerClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };
  
  const variantClasses = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500'
  };

  return (
    <div className={clsx('flex items-center space-x-2', className)} {...props}>
      <div 
        className={clsx(
          'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
          containerClasses[size]
        )}
      >
        <div 
          className={clsx(
            'h-full transition-all duration-300 ease-in-out',
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <span className="text-xs font-mono text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};