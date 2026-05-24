import WebSocket from 'ws';
import net from 'net';
import {
  MessageType,
  type RoomCreatedMessage,
  type ProtocolMessage,
  type ErrorMessage,
  type TunnelDataMessage,
  type TunnelCloseMessage,
  type TunnelStartMessage,
  DEFAULT_WS_PATH,
} from '@minecraft-lan-tunnel/shared';
import {
  ReconnectionManager,
} from '@minecraft-lan-tunnel/tunnel-core';
import type { Logger } from './logger';

export interface TunnelHostStatus {
  role: 'host';
  connected: boolean;
  inviteCode: string | null;
  tunnelActive: boolean;
  minecraftPort: number | null;
  clientCount: number;
  reconnecting: boolean;
}

type StatusCallback = (status: TunnelHostStatus) => void;

export class TunnelHost {
  private ws: WebSocket | null = null;
  private inviteCode: string | null = null;
  private minecraftPort: number | null = null;
  private tunnelActive = false;
  private sessions = new Map<string, net.Socket>();
  private statusCallback: StatusCallback | null = null;
  private reconnectionManager = new ReconnectionManager();
  private reconnecting = false;
  private disconnected = false;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly relayUrl: string,
    private readonly logger: Logger
  ) {}

  async createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      let wsUrl = this.relayUrl.replace(/^http/, 'ws');
      if (!wsUrl.endsWith('/ws')) {
        wsUrl += DEFAULT_WS_PATH;
      }
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.ws?.close();
      }, 10000);

      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify({ type: MessageType.CreateRoom, minecraftPort: 0 }));
        this.startKeepAlive();
      });

      this.ws.on('message', (data) => {
        try {
          const msg: ProtocolMessage = JSON.parse(data.toString());
          if (msg.type === MessageType.RoomCreated) {
            clearTimeout(timeout);
            this.inviteCode = (msg as RoomCreatedMessage).inviteCode;
            this.reconnectionManager.reset();
            this.emitStatus();
            resolve(this.inviteCode);
          } else if (msg.type === MessageType.Error) {
            clearTimeout(timeout);
            reject(new Error((msg as ErrorMessage).message));
          } else if (msg.type === MessageType.StatusUpdate) {
            this.emitStatus();
          } else if (msg.type === MessageType.TunnelData) {
            const tunnelMsg = msg as TunnelDataMessage;
            this.handleTunnelData(tunnelMsg.sessionId, Buffer.from(tunnelMsg.data, 'base64'));
          } else if (msg.type === MessageType.TunnelClose) {
            const closeMsg = msg as TunnelCloseMessage;
            this.handleTunnelClose(closeMsg.sessionId);
          } else if (msg.type === MessageType.TunnelStart) {
            const startMsg = msg as TunnelStartMessage;
            this.handleTunnelData(startMsg.sessionId, Buffer.alloc(0));
          }
        } catch (e) {
          this.logger.error('Failed to parse message', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

      this.ws.on('close', () => {
        if (!this.disconnected) {
          this.handleDisconnect();
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        this.logger.error('WebSocket error', { error: err.message });
        if (!this.inviteCode) {
          reject(new Error(`Connection failed: ${err.message}`));
        }
      });
    });
  }

  async startTunnel(port: number): Promise<void> {
    this.minecraftPort = port;
    this.tunnelActive = true;
    this.emitStatus();
  }

  private handleTunnelData(sessionId: string, payload: Buffer): void {
    if (!this.tunnelActive || !this.minecraftPort) return;

    let socket = this.sessions.get(sessionId);
    if (!socket) {
      socket = net.createConnection({ host: '127.0.0.1', port: this.minecraftPort });
      this.sessions.set(sessionId, socket);
      this.emitStatus();
      this.logger.info('New client session', { sessionId: sessionId.slice(0, 8) });

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
        this.emitStatus();
        this.logger.info('Client session closed', { sessionId: sessionId.slice(0, 8) });
      });

      socket.on('error', (err) => {
        this.logger.error('TCP connection error', { sessionId: sessionId.slice(0, 8), error: err.message });
        this.sessions.delete(sessionId);
        if (this.ws?.readyState === WebSocket.OPEN) {
          const msg: TunnelCloseMessage = {
            type: MessageType.TunnelClose,
            sessionId,
          };
          this.ws.send(JSON.stringify(msg));
        }
        this.emitStatus();
      });
    }

    if (payload.length > 0) {
      socket.write(payload);
    }
  }

  private handleTunnelClose(sessionId: string): void {
    const socket = this.sessions.get(sessionId);
    if (socket) {
      socket.destroy();
      this.sessions.delete(sessionId);
      this.emitStatus();
    }
  }

  private handleDisconnect(): void {
    this.tunnelActive = false;
    this.inviteCode = null;
    this.stopKeepAlive();
    for (const socket of this.sessions.values()) {
      socket.destroy();
    }
    this.sessions.clear();
    this.logger.warn('Disconnected from relay. Please create a new room and share the new invite code.');
    this.emitStatus();
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: MessageType.HealthCheck }));
      }
    }, 45000); // Every 45 seconds
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  onStatusUpdate(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  getStatus(): TunnelHostStatus {
    return {
      role: 'host',
      connected: this.ws?.readyState === WebSocket.OPEN,
      inviteCode: this.inviteCode,
      tunnelActive: this.tunnelActive,
      minecraftPort: this.minecraftPort,
      clientCount: this.sessions.size,
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
    this.stopKeepAlive();
    for (const socket of this.sessions.values()) {
      socket.destroy();
    }
    this.sessions.clear();
    this.ws?.close();
    this.ws = null;
    this.tunnelActive = false;
    this.emitStatus();
  }
}
