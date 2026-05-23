import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  createRoom: (relayUrl: string) => Promise<{ success: boolean; inviteCode?: string; error?: string }>;
  joinRoom: (relayUrl: string, inviteCode: string) => Promise<{ success: boolean; localPort?: number; error?: string }>;
  startTunnel: (port: number) => Promise<{ success: boolean; error?: string }>;
  stopTunnel: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<{
    hostActive: boolean;
    clientActive: boolean;
    hostStatus: unknown;
    clientStatus: unknown;
  }>;
  copyToClipboard: (text: string) => Promise<{ success: boolean }>;
  autoDetectPort: () => Promise<{ success: boolean; port: number | null; error?: string }>;
  getLogs: () => Promise<Array<{ timestamp: number; level: string; message: string; details?: Record<string, unknown> }>>;
  updateSettings: (settings: Record<string, unknown>) => Promise<{ success: boolean }>;
  onStatusUpdate: (callback: (status: unknown) => void) => () => void;
  onLogEntry: (callback: (entry: unknown) => void) => () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  createRoom: (relayUrl: string) => ipcRenderer.invoke('create-room', relayUrl),
  joinRoom: (relayUrl: string, inviteCode: string) => ipcRenderer.invoke('join-room', relayUrl, inviteCode),
  startTunnel: (port: number) => ipcRenderer.invoke('start-tunnel', port),
  stopTunnel: () => ipcRenderer.invoke('stop-tunnel'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  autoDetectPort: () => ipcRenderer.invoke('auto-detect-port'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  updateSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('update-settings', settings),
  onStatusUpdate: (callback: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on('status-update', handler as (...args: unknown[]) => void);
    return () => ipcRenderer.removeListener('status-update', handler as (...args: unknown[]) => void);
  },
  onLogEntry: (callback: (entry: unknown) => void) => {
    const handler = (_event: unknown, entry: unknown) => callback(entry);
    ipcRenderer.on('log-entry', handler as (...args: unknown[]) => void);
    return () => ipcRenderer.removeListener('log-entry', handler as (...args: unknown[]) => void);
  },
} satisfies ElectronAPI);
