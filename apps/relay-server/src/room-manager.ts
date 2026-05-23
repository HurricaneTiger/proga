import { WebSocket } from 'ws';
import {
  generateInviteCode,
  RoomStatus,
  MAX_ROOMS,
  ROOM_TIMEOUT_MS,
} from '@minecraft-lan-tunnel/shared';

export interface Room {
  inviteCode: string;
  hostWs: WebSocket;
  clients: WebSocket[];
  hostMinecraftPort: number;
  status: RoomStatus;
  createdAt: Date;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private maxRooms: number;
  private roomTimeoutMs: number;

  constructor(maxRooms = MAX_ROOMS, roomTimeoutMs = ROOM_TIMEOUT_MS) {
    this.maxRooms = maxRooms;
    this.roomTimeoutMs = roomTimeoutMs;
  }

  createRoom(hostWs: WebSocket, minecraftPort: number): string {
    if (this.rooms.size >= this.maxRooms) {
      throw new Error('Maximum number of rooms reached');
    }

    let inviteCode: string;
    do {
      inviteCode = generateInviteCode();
    } while (this.rooms.has(inviteCode));

    const room: Room = {
      inviteCode,
      hostWs,
      clients: [],
      hostMinecraftPort: minecraftPort,
      status: RoomStatus.WaitingForClient,
      createdAt: new Date(),
    };

    this.rooms.set(inviteCode, room);
    return inviteCode;
  }

  joinRoom(inviteCode: string, clientWs: WebSocket): Room {
    const room = this.rooms.get(inviteCode);
    if (!room) {
      throw new Error('Room not found');
    }
    if (room.status === RoomStatus.Closed) {
      throw new Error('Room is closed');
    }

    room.clients.push(clientWs);
    room.status = RoomStatus.Connected;
    return room;
  }

  removeRoom(inviteCode: string): void {
    this.rooms.delete(inviteCode);
  }

  getRoom(inviteCode: string): Room | undefined {
    return this.rooms.get(inviteCode);
  }

  removeClientFromRoom(inviteCode: string, clientWs: WebSocket): void {
    const room = this.rooms.get(inviteCode);
    if (!room) return;

    room.clients = room.clients.filter((ws) => ws !== clientWs);
    if (room.clients.length === 0) {
      room.status = RoomStatus.WaitingForClient;
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getConnectionCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += 1 + room.clients.length; // host + clients
    }
    return count;
  }

  cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.createdAt.getTime() >= this.roomTimeoutMs) {
        room.status = RoomStatus.Closed;
        // Close host WebSocket
        if (room.hostWs.readyState === 1) {
          room.hostWs.close();
        }
        // Close all client WebSockets
        for (const client of room.clients) {
          if (client.readyState === 1) {
            client.close();
          }
        }
        this.rooms.delete(code);
      }
    }
  }
}
