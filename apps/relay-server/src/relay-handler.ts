import { WebSocket } from 'ws';
import {
  MessageType,
  ErrorCode,
  type ProtocolMessage,
  type ErrorMessage,
  type TunnelDataMessage,
  type TunnelCloseMessage,
} from '@minecraft-lan-tunnel/shared';
import { RoomManager } from './room-manager.js';

interface ClientInfo {
  ws: WebSocket;
  inviteCode: string;
  role: 'host' | 'client';
}

export class RelayHandler {
  private clientMap: Map<WebSocket, ClientInfo> = new Map();
  private roomManager: RoomManager;

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  handleConnection(ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ProtocolMessage;
        this.handleMessage(ws, message);
      } catch {
        this.sendError(ws, ErrorCode.InvalidMessage, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: ProtocolMessage): void {
    switch (message.type) {
      case MessageType.CreateRoom:
        this.handleCreateRoom(ws, message.minecraftPort);
        break;
      case MessageType.JoinRoom:
        this.handleJoinRoom(ws, message.inviteCode);
        break;
      case MessageType.TunnelData:
        this.handleTunnelData(ws, message);
        break;
      case MessageType.TunnelClose:
        this.handleTunnelClose(ws, message);
        break;
      case MessageType.HealthCheck:
        ws.send(JSON.stringify({ type: MessageType.HealthCheck }));
        break;
      default:
        this.sendError(ws, ErrorCode.InvalidMessage, 'Unknown message type');
    }
  }

  private handleCreateRoom(ws: WebSocket, minecraftPort: number): void {
    try {
      const inviteCode = this.roomManager.createRoom(ws, minecraftPort);
      this.clientMap.set(ws, { ws, inviteCode, role: 'host' });
      ws.send(
        JSON.stringify({
          type: MessageType.RoomCreated,
          inviteCode,
        })
      );
    } catch (err) {
      this.sendError(
        ws,
        ErrorCode.InternalError,
        err instanceof Error ? err.message : 'Failed to create room'
      );
    }
  }

  private handleJoinRoom(ws: WebSocket, inviteCode: string): void {
    try {
      const room = this.roomManager.joinRoom(inviteCode, ws);
      this.clientMap.set(ws, { ws, inviteCode, role: 'client' });
      ws.send(
        JSON.stringify({
          type: MessageType.RoomJoined,
          inviteCode,
        })
      );
      // Notify the host that a client has joined
      room.hostWs.send(
        JSON.stringify({
          type: MessageType.StatusUpdate,
          roomStatus: room.status,
          clientCount: room.clients.length,
        })
      );
    } catch (err) {
      const errorCode =
        err instanceof Error && err.message === 'Room not found'
          ? ErrorCode.RoomNotFound
          : ErrorCode.InternalError;
      this.sendError(
        ws,
        errorCode,
        err instanceof Error ? err.message : 'Failed to join room'
      );
    }
  }

  private handleTunnelData(ws: WebSocket, message: TunnelDataMessage): void {
    const clientInfo = this.clientMap.get(ws);
    if (!clientInfo) return;

    const room = this.roomManager.getRoom(clientInfo.inviteCode);
    if (!room) return;

    if (clientInfo.role === 'client') {
      // Forward from client to host
      if (room.hostWs.readyState === WebSocket.OPEN) {
        room.hostWs.send(JSON.stringify(message));
      }
    } else {
      // Forward from host to correct client by sessionId
      for (const client of room.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    }
  }

  private handleTunnelClose(ws: WebSocket, message: TunnelCloseMessage): void {
    const clientInfo = this.clientMap.get(ws);
    if (!clientInfo) return;

    const room = this.roomManager.getRoom(clientInfo.inviteCode);
    if (!room) return;

    if (clientInfo.role === 'client') {
      // Notify host
      if (room.hostWs.readyState === WebSocket.OPEN) {
        room.hostWs.send(JSON.stringify(message));
      }
    } else {
      // Notify all clients
      for (const client of room.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    }
  }

  private handleDisconnect(ws: WebSocket): void {
    const clientInfo = this.clientMap.get(ws);
    if (!clientInfo) return;

    const room = this.roomManager.getRoom(clientInfo.inviteCode);
    if (room) {
      if (clientInfo.role === 'host') {
        // Notify all clients that host disconnected
        for (const client of room.clients) {
          if (client.readyState === WebSocket.OPEN) {
            this.sendError(client, ErrorCode.RoomClosed, 'Host disconnected');
            client.close();
          }
        }
        this.roomManager.removeRoom(clientInfo.inviteCode);
      } else {
        // Remove client from room
        this.roomManager.removeClientFromRoom(clientInfo.inviteCode, ws);
        // Notify host
        if (room.hostWs.readyState === WebSocket.OPEN) {
          room.hostWs.send(
            JSON.stringify({
              type: MessageType.StatusUpdate,
              roomStatus: room.status,
              clientCount: room.clients.length,
            })
          );
        }
      }
    }

    this.clientMap.delete(ws);
  }

  private sendError(ws: WebSocket, code: ErrorCode, message: string): void {
    const errorMsg: ErrorMessage = {
      type: MessageType.Error,
      code,
      message,
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorMsg));
    }
  }
}
