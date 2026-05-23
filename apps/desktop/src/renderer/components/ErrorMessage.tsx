import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div className={`flex items-center gap-3 bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3 ${className}`}>
      <AlertTriangle size={18} className="text-danger-400 shrink-0" />
      <span className="text-danger-400 text-sm">{message}</span>
    </div>
  );
}
