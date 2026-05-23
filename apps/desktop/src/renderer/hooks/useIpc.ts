import { useState, useEffect, useCallback } from 'react';

// Type declarations for the Electron API exposed via preload
interface ElectronAPI {
  createRoom: (relayUrl: string) => Promise<{ success: boolean; inviteCode?: string; error?: string }>;
  joinRoom: (relayUrl: string, inviteCode: string) => Promise<{ success: boolean; localPort?: number; error?: string }>;
  startTunnel: (port: number) => Promise<{ success: boolean; error?: string }>;
  stopTunnel: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<{
    hostActive: boolean;
    clientActive: boolean;
    hostStatus: HostStatus | null;
    clientStatus: ClientStatus | null;
  }>;
  copyToClipboard: (text: string) => Promise<{ success: boolean }>;
  autoDetectPort: () => Promise<{ success: boolean; port: number | null; error?: string }>;
  getLogs: () => Promise<LogEntryData[]>;
  updateSettings: (settings: Record<string, unknown>) => Promise<{ success: boolean }>;
  onStatusUpdate: (callback: (status: unknown) => void) => () => void;
  onLogEntry: (callback: (entry: unknown) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export interface HostStatus {
  role: 'host';
  connected: boolean;
  inviteCode: string | null;
  tunnelActive: boolean;
  minecraftPort: number | null;
  clientCount: number;
  reconnecting: boolean;
}

export interface ClientStatus {
  role: 'client';
  connected: boolean;
  inviteCode: string | null;
  localPort: number | null;
  hostOnline: boolean;
  reconnecting: boolean;
}

export interface LogEntryData {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

interface Settings {
  relayUrl: string;
  localPort: number;
}

const DEFAULT_SETTINGS: Settings = {
  relayUrl: 'http://localhost:3000',
  localPort: 25565,
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem('mc-tunnel-settings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Settings): void {
  localStorage.setItem('mc-tunnel-settings', JSON.stringify(settings));
}

// Room state hook
export function useRoom() {
  const [hostStatus, setHostStatus] = useState<HostStatus | null>(null);
  const [clientStatus, setClientStatus] = useState<ClientStatus | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onStatusUpdate((status: unknown) => {
      const s = status as HostStatus | ClientStatus;
      if ('role' in (s as Record<string, unknown>)) {
        if ((s as HostStatus).role === 'host') {
          setHostStatus(s as HostStatus);
        } else {
          setClientStatus(s as ClientStatus);
        }
      }
    });

    // Initial fetch
    window.electronAPI.getStatus().then((result) => {
      if (result.hostStatus) setHostStatus(result.hostStatus as HostStatus);
      if (result.clientStatus) setClientStatus(result.clientStatus as ClientStatus);
    });

    return unsubscribe;
  }, []);

  return { hostStatus, clientStatus };
}

// Logs hook
export function useLogs() {
  const [logs, setLogs] = useState<LogEntryData[]>([]);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Fetch existing logs
    window.electronAPI.getLogs().then((entries) => {
      setLogs(entries);
    });

    const unsubscribe = window.electronAPI.onLogEntry((entry: unknown) => {
      setLogs((prev) => [...prev, entry as LogEntryData]);
    });

    return unsubscribe;
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, clearLogs };
}

// Health check hook
export function useHealth() {
  const [relayConnected, setRelayConnected] = useState(false);

  useEffect(() => {
    const { relayUrl } = loadSettings();

    const checkHealth = async () => {
      try {
        const response = await fetch(`${relayUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        setRelayConnected(response.ok);
      } catch {
        setRelayConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return { relayConnected };
}

// Settings hook
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  return { settings, updateSettings };
}
