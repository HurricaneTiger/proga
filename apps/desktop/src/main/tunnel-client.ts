import WebSocket from 'ws';
import net from 'net';
import { randomUUID } from 'crypto';
import {
  MessageType,
  type RoomJoinedMessage,
  type ProtocolMessage,
  type ErrorMessage,
  type TunnelDataMessage,
  type TunnelCloseMessage,
  DEFAULT_WS_PATH,
  DEFAULT_MINECRAFT_PORT,
} from '@minecraft-lan-tunnel/shared';
import {
  ReconnectionManager,
} from '@minecraft-lan-tunnel/tunnel-core';
import type { Logger } from './logger.js';

export interface TunnelClientStatus {
  role: 'client';
  connected: boolean;
  inviteCode: string | null;
  localPort: number | null;
  hostOnline: boolean;
  reconnecting: boolean;
}

type StatusCallback = (status: TunnelClientStatus) => void;

export class TunnelClient {
  private ws: WebSocket | null = null;
  private server: net.Server | null = null;
  private inviteCode: string | null = null;
  private localPort: number | null = null;
  private sessions = new Map<string, net.Socket>();
  private statusCallback: StatusCallback | null = null;
  private hostOnline = false;
  private reconnectionManager = new ReconnectionManager();
  private reconnecting = false;
  private disconnected = false;

  constructor(
    private readonly relayUrl: string,
    private readonly logger: Logger
  ) {}

  async joinRoom(inviteCode: string, preferredPort?: number): Promise<number> {
    this.inviteCode = inviteCode.toUpperCase();
    await this.connectToRelay();
    const port = await this.startLocalServer(preferredPort ?? DEFAULT_MINECRAFT_PORT);
    this.localPort = port;
    this.emitStatus();
    return port;
  }

  private connectToRelay(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.relayUrl.replace(/^http/, 'ws') + DEFAULT_WS_PATH;
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.ws?.close();
      }, 10000);

      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify({
          type: MessageType.JoinRoom,
          inviteCode: this.inviteCode,
        }));
      });

      this.ws.on('message', (data) => {
        try {
          const msg: ProtocolMessage = JSON.parse(data.toString());
          if (msg.type === MessageType.RoomJoined) {
            clearTimeout(timeout);
            this.hostOnline = true;
            this.reconnectionManager.reset();
            this.emitStatus();
            resolve();
          } else if (msg.type === MessageType.Error) {
            clearTimeout(timeout);
            reject(new Error((msg as ErrorMessage).message));
          } else if (msg.type === MessageType.StatusUpdate) {
            this.emitStatus();
          } else if (msg.type === MessageType.TunnelData) {
            const tunnelMsg = msg as TunnelDataMessage;
            const socket = this.sessions.get(tunnelMsg.sessionId);
            if (socket) {
              socket.write(Buffer.from(tunnelMsg.data, 'base64'));
            }
          } else if (msg.type === MessageType.TunnelClose) {
            const closeMsg = msg as TunnelCloseMessage;
            const socket = this.sessions.get(closeMsg.sessionId);
            if (socket) {
              socket.destroy();
              this.sessions.delete(closeMsg.sessionId);
            }
          }
        } catch (e) {
          this.logger.error('Failed to parse message', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

      this.ws.on('close', () => {
        this.hostOnline = false;
        this.emitStatus();
        if (!this.disconnected) {
          this.handleDisconnect();
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        this.logger.error('WebSocket error', { error: err.message });
        if (!this.hostOnline) {
          reject(new Error(`Connection failed: ${err.message}`));
        }
      });
    });
  }

  private async startLocalServer(preferredPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        const sessionId = randomUUID();
        this.sessions.set(sessionId, socket);
        this.logger.info('Local Minecraft connected', { sessionId: sessionId.slice(0, 8) });

        // Notify relay about new session
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: MessageType.TunnelStart,
            sessionId,
          }));
        }

        socket.on('data', (data) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            const msg: TunnelDataMessage = {
              type: MessageType.TunnelData,
              sessionId,
              data: data.toString('base64'),
            };
            this.ws.send(JSON.stringify(msg));
          }
        });

        socket.on('close', () => {
          this.sessions.delete(sessionId);
          if (this.ws?.readyState === WebSocket.OPEN) {
            const msg: TunnelCloseMessage = {
              type: MessageType.TunnelClose,
              sessionId,
            };
            this.ws.send(JSON.stringify(msg));
          }
        });

        socket.on('error', (err) => {
          this.logger.error('Local socket error', { error: err.message });
          this.sessions.delete(sessionId);
        });
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Try next port
          this.server!.listen(0, '127.0.0.1');
        } else {
          reject(err);
        }
      });

      this.server.on('listening', () => {
        const addr = this.server!.address() as net.AddressInfo;
        resolve(addr.port);
      });

      this.server.listen(preferredPort, '127.0.0.1');
    });
  }

  private async handleDisconnect(): Promise<void> {
    this.reconnecting = true;
    this.emitStatus();
    this.logger.warn('Disconnected from relay, attempting reconnection...');

    while (!this.disconnected) {
      await this.reconnectionManager.scheduleReconnect();
      if (this.disconnected) break;

      try {
        await this.connectToRelay();
        this.reconnecting = false;
        this.logger.info('Reconnected to relay');
        this.emitStatus();
        return;
      } catch {
        this.logger.warn('Reconnection attempt failed');
      }
    }
  }

  onStatusUpdate(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  getStatus(): TunnelClientStatus {
    return {
      role: 'client',
      connected: this.ws?.readyState === WebSocket.OPEN,
      inviteCode: this.inviteCode,
      localPort: this.localPort,
      hostOnline: this.hostOnline,
      reconnecting: this.reconnecting,
    };
  }

  private emitStatus(): void {
    if (this.statusCallback) {
      this.statusCallback(this.getStatus());
    }
  }

  disconnect(): void {
    this.disconnected = true;
    this.reconnectionManager.cancel();
    for (const socket of this.sessions.values()) {
      socket.destroy();
    }
    this.sessions.clear();
    this.server?.close();
    this.server = null;
    this.ws?.close();
    this.ws = null;
    this.emitStatus();
  }
}
