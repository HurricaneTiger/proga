import React from 'react';
import { User } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface Connection {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'connecting';
}

interface ConnectionListProps {
  connections: Connection[];
}

export function ConnectionList({ connections }: ConnectionListProps) {
  if (connections.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-4">
        Пока никто не подключился
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center gap-3 bg-dark-700 rounded-lg px-4 py-3"
        >
          <User size={18} className="text-gray-400" />
          <span className="flex-1 text-sm">{conn.name}</span>
          <StatusBadge
            status={conn.status}
            text={conn.status === 'online' ? 'Онлайн' : conn.status === 'connecting' ? 'Подключается' : 'Отключен'}
          />
        </div>
      ))}
    </div>
  );
}
