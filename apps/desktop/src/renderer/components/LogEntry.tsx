import React from 'react';

interface LogEntryProps {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

const levelColors = {
  info: 'bg-primary-500/20 text-primary-400',
  warn: 'bg-warning-500/20 text-warning-400',
  error: 'bg-danger-500/20 text-danger-400',
};

const levelLabels = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

export function LogEntry({ timestamp, level, message, details }: LogEntryProps) {
  const time = new Date(timestamp).toLocaleTimeString('ru-RU');

  return (
    <div className="flex items-start gap-3 py-1.5 font-mono text-xs">
      <span className="text-gray-500 shrink-0">{time}</span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${levelColors[level]}`}>
        {levelLabels[level]}
      </span>
      <span className="text-gray-200">
        {message}
        {details && (
          <span className="text-gray-500 ml-2">
            {JSON.stringify(details)}
          </span>
        )}
      </span>
    </div>
  );
}
