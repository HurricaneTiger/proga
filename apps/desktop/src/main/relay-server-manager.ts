import { ChildProcess, fork } from 'child_process';
import path from 'path';
import net from 'net';

export interface RelayServerStatus {
  running: boolean;
  port: number | null;
  error: string | null;
}

export class RelayServerManager {
  private process: ChildProcess | null = null;
  private port: number | null = null;
  private status: RelayServerStatus = { running: false, port: null, error: null };
  private onStatusChange: ((status: RelayServerStatus) => void) | null = null;

  private getRelayServerPath(): string {
    // In production (packaged app), the relay server is in resources
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'relay-server.cjs');
    }
    // In development, use the bundled file from resources dir
    return path.join(__dirname, '..', 'resources', 'relay-server.cjs');
  }

  async start(): Promise<number> {
    if (this.process) {
      if (this.port) return this.port;
      throw new Error('Relay server is already starting');
    }

    const port = await this.findAvailablePort(3000);
    this.port = port;

    const serverPath = this.getRelayServerPath();

    this.process = fork(serverPath, [], {
      env: {
        ...process.env,
        RELAY_PORT: String(port),
        WS_PATH: '/ws',
        MAX_ROOMS: '100',
        ROOM_TIMEOUT_MS: '3600000',
      },
      silent: true,
    });

    this.process.on('exit', (code) => {
      this.process = null;
      this.status = {
        running: false,
        port: null,
        error: code !== 0 && code !== null ? `Relay server exited with code ${code}` : null,
      };
      this.notifyStatusChange();
    });

    this.process.on('error', (err) => {
      this.process = null;
      this.status = { running: false, port: null, error: err.message };
      this.notifyStatusChange();
    });

    if (this.process.stdout) {
      this.process.stdout.on('data', (data: Buffer) => {
        console.log(`[relay-server] ${data.toString().trim()}`);
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        console.error(`[relay-server] ${data.toString().trim()}`);
      });
    }

    // Wait for the server to be ready
    await this.waitForReady(port);

    this.status = { running: true, port, error: null };
    this.notifyStatusChange();
    return port;
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.port = null;
    this.status = { running: false, port: null, error: null };
    this.notifyStatusChange();
  }

  getStatus(): RelayServerStatus {
    return this.status;
  }

  setStatusCallback(callback: (status: RelayServerStatus) => void): void {
    this.onStatusChange = callback;
  }

  private notifyStatusChange(): void {
    if (this.onStatusChange) {
      this.onStatusChange(this.status);
    }
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port < startPort + 10; port++) {
      const available = await this.isPortAvailable(port);
      if (available) return port;
    }
    throw new Error('No available port found for relay server');
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
  }

  private waitForReady(port: number, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Relay server failed to start within timeout'));
          return;
        }

        const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
          socket.destroy();
          resolve();
        });

        socket.on('error', () => {
          setTimeout(check, 200);
        });
      };

      check();
    });
  }
}

// Need app import for isPackaged check
import { app } from 'electron';
