import WebSocket from 'ws';
import net from 'net';
import {
  MessageType,
  type RoomCreatedMessage,
  type ProtocolMessage,
  type ErrorMessage,
  DEFAULT_WS_PATH,
} from '@minecraft-lan-tunnel/shared';
import {
  encodeFrame,
  decodeFrame,
  FRAME_TYPE_TUNNEL_DATA,
  FRAME_TYPE_TUNNEL_CLOSE,
  ReconnectionManager,
} from '@minecraft-lan-tunnel/tunnel-core';
import type { Logger } from './logger.js';

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

  constructor(
    private readonly relayUrl: string,
    private readonly logger: Logger
  ) {}

  async createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.relayUrl.replace(/^http/, 'ws') + DEFAULT_WS_PATH;
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.ws?.close();
      }, 10000);

      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify({ type: MessageType.CreateRoom, minecraftPort: 0 }));
      });

      this.ws.on('message', (data) => {
        try {
          if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
            this.handleBinaryMessage(
              Buffer.isBuffer(data) ? new Uint8Array(data) : new Uint8Array(data as ArrayBuffer)
            );
            return;
          }
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

  private handleBinaryMessage(data: Uint8Array): void {
    try {
      const frame = decodeFrame(data);
      if (frame.type === FRAME_TYPE_TUNNEL_DATA) {
        this.handleTunnelData(frame.sessionId, frame.payload);
      } else if (frame.type === FRAME_TYPE_TUNNEL_CLOSE) {
        this.handleTunnelClose(frame.sessionId);
      }
    } catch (e) {
      this.logger.error('Failed to decode binary frame', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private handleTunnelData(sessionId: string, payload: Uint8Array): void {
    if (!this.tunnelActive || !this.minecraftPort) return;

    let socket = this.sessions.get(sessionId);
    if (!socket) {
      socket = net.createConnection({ host: '127.0.0.1', port: this.minecraftPort });
      this.sessions.set(sessionId, socket);
      this.emitStatus();
      this.logger.info('New client session', { sessionId: sessionId.slice(0, 8) });

      socket.on('data', (data) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          const frame = encodeFrame(FRAME_TYPE_TUNNEL_DATA, sessionId, new Uint8Array(data));
          this.ws.send(frame);
        }
      });

      socket.on('close', () => {
        this.sessions.delete(sessionId);
        if (this.ws?.readyState === WebSocket.OPEN) {
          const frame = encodeFrame(FRAME_TYPE_TUNNEL_CLOSE, sessionId);
          this.ws.send(frame);
        }
        this.emitStatus();
        this.logger.info('Client session closed', { sessionId: sessionId.slice(0, 8) });
      });

      socket.on('error', (err) => {
        this.logger.error('TCP connection error', { sessionId: sessionId.slice(0, 8), error: err.message });
        this.sessions.delete(sessionId);
        if (this.ws?.readyState === WebSocket.OPEN) {
          const frame = encodeFrame(FRAME_TYPE_TUNNEL_CLOSE, sessionId);
          this.ws.send(frame);
        }
        this.emitStatus();
      });
    }

    socket.write(Buffer.from(payload));
  }

  private handleTunnelClose(sessionId: string): void {
    const socket = this.sessions.get(sessionId);
    if (socket) {
      socket.destroy();
      this.sessions.delete(sessionId);
      this.emitStatus();
    }
  }

  private async handleDisconnect(): Promise<void> {
    this.reconnecting = true;
    this.emitStatus();
    this.logger.warn('Disconnected from relay, attempting reconnection...');

    while (!this.disconnected) {
      await this.reconnectionManager.scheduleReconnect();
      if (this.disconnected) break;

      try {
        await this.createRoom();
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
