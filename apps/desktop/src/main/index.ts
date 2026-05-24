import { app, BrowserWindow, ipcMain, clipboard } from 'electron';
import path from 'path';
import { TunnelHost } from './tunnel-host.js';
import { TunnelClient } from './tunnel-client.js';
import { PortDetector } from './port-detector.js';
import { Logger } from './logger.js';
import { RelayServerManager } from './relay-server-manager.js';

let mainWindow: BrowserWindow | null = null;
let tunnelHost: TunnelHost | null = null;
let tunnelClient: TunnelClient | null = null;
const portDetector = new PortDetector();
const logger = new Logger();
const relayServerManager = new RelayServerManager();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f0f1a',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.setWindow(mainWindow);
}

app.whenReady().then(async () => {
  // Start the built-in relay server
  try {
    const relayPort = await relayServerManager.start();
    logger.info('Built-in relay server started', { port: relayPort });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Failed to start built-in relay server', { error: message });
  }

  relayServerManager.setStatusCallback((status) => {
    mainWindow?.webContents.send('relay-server-status', status);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  tunnelHost?.disconnect();
  tunnelClient?.disconnect();
  portDetector.stop();
  relayServerManager.stop();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

ipcMain.handle('create-room', async (_event, relayUrl: string) => {
  try {
    tunnelHost = new TunnelHost(relayUrl, logger);
    const inviteCode = await tunnelHost.createRoom();
    tunnelHost.onStatusUpdate((status) => {
      mainWindow?.webContents.send('status-update', status);
    });
    logger.info('Room created', { inviteCode });
    return { success: true, inviteCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create room', { error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('join-room', async (_event, relayUrl: string, inviteCode: string) => {
  try {
    tunnelClient = new TunnelClient(relayUrl, logger);
    const localPort = await tunnelClient.joinRoom(inviteCode);
    tunnelClient.onStatusUpdate((status) => {
      mainWindow?.webContents.send('status-update', status);
    });
    logger.info('Joined room', { inviteCode, localPort });
    return { success: true, localPort };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to join room', { error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('start-tunnel', async (_event, port: number) => {
  try {
    if (!tunnelHost) {
      throw new Error('No active room');
    }
    await tunnelHost.startTunnel(port);
    logger.info('Tunnel started', { port });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start tunnel', { error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('stop-tunnel', async () => {
  try {
    tunnelHost?.disconnect();
    tunnelClient?.disconnect();
    tunnelHost = null;
    tunnelClient = null;
    logger.info('Tunnel stopped');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to stop tunnel', { error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('get-status', async () => {
  return {
    hostActive: tunnelHost !== null,
    clientActive: tunnelClient !== null,
    hostStatus: tunnelHost?.getStatus() ?? null,
    clientStatus: tunnelClient?.getStatus() ?? null,
  };
});

ipcMain.handle('copy-to-clipboard', async (_event, text: string) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('auto-detect-port', async () => {
  try {
    const port = await portDetector.detectPort();
    if (port) {
      logger.info('Auto-detected Minecraft port', { port });
    } else {
      logger.warn('Could not auto-detect Minecraft port');
    }
    return { success: true, port };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Port detection failed', { error: message });
    return { success: false, port: null, error: message };
  }
});

ipcMain.handle('get-logs', async () => {
  return logger.getEntries();
});

ipcMain.handle('update-settings', async (_event, settings: Record<string, unknown>) => {
  logger.info('Settings updated', settings);
  return { success: true };
});

ipcMain.handle('get-relay-server-status', async () => {
  return relayServerManager.getStatus();
});
