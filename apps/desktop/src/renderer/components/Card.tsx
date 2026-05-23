import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hoverable = false, onClick }: CardProps) {
  const base = 'bg-dark-800 border border-dark-600 rounded-xl p-6';
  const hover = hoverable ? 'transition-all duration-300 hover:border-primary-500 hover:shadow-glow cursor-pointer' : '';

  return (
    <div className={`${base} ${hover} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
