import React from 'react';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'connecting' | 'error';
  text: string;
}

const statusColors = {
  online: 'bg-success-500',
  offline: 'bg-gray-500',
  connecting: 'bg-warning-500 animate-pulse',
  error: 'bg-danger-500',
};

const textColors = {
  online: 'text-success-400',
  offline: 'text-gray-400',
  connecting: 'text-warning-400',
  error: 'text-danger-400',
};

export function StatusBadge({ status, text }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      <span className={`text-sm ${textColors[status]}`}>{text}</span>
    </div>
  );
}
