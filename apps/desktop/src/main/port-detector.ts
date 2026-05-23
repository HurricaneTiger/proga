import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT_PATTERNS = [
  /Local game hosted on port (\d+)/,
  /Started serving on port (\d+)/,
  // Russian locale pattern
  /\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u0438\u0433\u0440\u0430 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0430 \u043d\u0430 \u043f\u043e\u0440\u0442\u0443 (\d+)/,
];

function getMinecraftLogPath(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', '.minecraft', 'logs', 'latest.log');
  }
  return path.join(os.homedir(), '.minecraft', 'logs', 'latest.log');
}

export class PortDetector {
  private watcher: fs.FSWatcher | null = null;
  private onChange: ((port: number) => void) | null = null;

  async detectPort(): Promise<number | null> {
    const logPath = getMinecraftLogPath();

    try {
      await fs.promises.access(logPath, fs.constants.R_OK);
    } catch {
      return null;
    }

    const content = await fs.promises.readFile(logPath, 'utf-8');
    return this.parsePort(content);
  }

  private parsePort(content: string): number | null {
    const lines = content.split('\n').reverse();
    for (const line of lines) {
      for (const pattern of PORT_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const port = parseInt(match[1], 10);
          if (port > 0 && port <= 65535) {
            return port;
          }
        }
      }
    }
    return null;
  }

  watch(callback: (port: number) => void): void {
    this.onChange = callback;
    const logPath = getMinecraftLogPath();

    try {
      this.watcher = fs.watch(logPath, { persistent: false }, async () => {
        const port = await this.detectPort();
        if (port && this.onChange) {
          this.onChange(port);
        }
      });
    } catch {
      // Log file may not exist yet
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.onChange = null;
  }
}
