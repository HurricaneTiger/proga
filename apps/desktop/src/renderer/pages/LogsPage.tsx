import React, { useState, useRef, useEffect } from 'react';
import { Trash2, ArrowDown } from 'lucide-react';
import { Button } from '../components/Button';
import { LogEntry } from '../components/LogEntry';
import { useLogs } from '../hooks/useIpc';

type LogLevel = 'all' | 'info' | 'warn' | 'error';

export function LogsPage() {
  const { logs, clearLogs } = useLogs();
  const [filter, setFilter] = useState<LogLevel>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.level === filter);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Логи</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-dark-700 rounded-lg overflow-hidden">
            {(['all', 'info', 'warn', 'error'] as LogLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === level
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {level === 'all' ? 'Все' : level.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-2 rounded-lg transition-colors ${
              autoScroll ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:text-white'
            }`}
            title={autoScroll ? 'Автопрокрутка включена' : 'Автопрокрутка выключена'}
          >
            <ArrowDown size={16} />
          </button>
          <Button variant="secondary" size="sm" onClick={clearLogs}>
            <span className="flex items-center gap-1.5">
              <Trash2 size={12} />
              Очистить
            </span>
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 bg-dark-800 border border-dark-600 rounded-xl p-4 overflow-y-auto"
      >
        {filteredLogs.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Нет записей</p>
        ) : (
          filteredLogs.map((entry, i) => (
            <LogEntry key={i} {...entry} />
          ))
        )}
      </div>
    </div>
  );
}
