import type { BrowserWindow } from 'electron';

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

const MAX_ENTRIES = 500;

export class Logger {
  private entries: LogEntry[] = [];
  private window: BrowserWindow | null = null;

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  info(message: string, details?: Record<string, unknown>): void {
    this.addEntry('info', message, details);
  }

  warn(message: string, details?: Record<string, unknown>): void {
    this.addEntry('warn', message, details);
  }

  error(message: string, details?: Record<string, unknown>): void {
    this.addEntry('error', message, details);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  private addEntry(level: LogEntry['level'], message: string, details?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      details,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }

    this.window?.webContents.send('log-entry', entry);
  }
}
