import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../room-manager.js';
import { RoomStatus } from '@minecraft-lan-tunnel/shared';

// Mock WebSocket objects for testing
function createMockWs(): any {
  return {
    readyState: 1, // WebSocket.OPEN
    send: () => {},
    close: () => {},
    on: () => {},
    ping: () => {},
  };
}

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager(100, 3600000);
  });

  describe('createRoom', () => {
    it('should create a room and return a 6-character invite code', () => {
      const hostWs = createMockWs();
      const inviteCode = roomManager.createRoom(hostWs, 25565);

      expect(inviteCode).toHaveLength(6);
      expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should store the room with correct initial state', () => {
      const hostWs = createMockWs();
      const inviteCode = roomManager.createRoom(hostWs, 25565);

      const room = roomManager.getRoom(inviteCode);
      expect(room).toBeDefined();
      expect(room!.hostWs).toBe(hostWs);
      expect(room!.clients).toHaveLength(0);
      expect(room!.hostMinecraftPort).toBe(25565);
      expect(room!.status).toBe(RoomStatus.WaitingForClient);
    });

    it('should generate unique invite codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const code = roomManager.createRoom(createMockWs(), 25565);
        codes.add(code);
      }
      expect(codes.size).toBe(50);
    });

    it('should throw when max rooms reached', () => {
      const manager = new RoomManager(2, 3600000);
      manager.createRoom(createMockWs(), 25565);
      manager.createRoom(createMockWs(), 25565);

      expect(() => manager.createRoom(createMockWs(), 25565)).toThrow(
        'Maximum number of rooms reached'
      );
    });
  });

  describe('joinRoom', () => {
    it('should add client to existing room', () => {
      const hostWs = createMockWs();
      const clientWs = createMockWs();
      const inviteCode = roomManager.createRoom(hostWs, 25565);

      const room = roomManager.joinRoom(inviteCode, clientWs);

      expect(room.clients).toContain(clientWs);
      expect(room.status).toBe(RoomStatus.Connected);
    });

    it('should throw for non-existent room', () => {
      const clientWs = createMockWs();
      expect(() => roomManager.joinRoom('XXXXXX', clientWs)).toThrow(
        'Room not found'
      );
    });

    it('should allow multiple clients to join', () => {
      const hostWs = createMockWs();
      const inviteCode = roomManager.createRoom(hostWs, 25565);

      roomManager.joinRoom(inviteCode, createMockWs());
      roomManager.joinRoom(inviteCode, createMockWs());

      const room = roomManager.getRoom(inviteCode);
      expect(room!.clients).toHaveLength(2);
    });
  });

  describe('removeRoom', () => {
    it('should remove a room', () => {
      const inviteCode = roomManager.createRoom(createMockWs(), 25565);
      roomManager.removeRoom(inviteCode);

      expect(roomManager.getRoom(inviteCode)).toBeUndefined();
    });
  });

  describe('removeClientFromRoom', () => {
    it('should remove a specific client', () => {
      const hostWs = createMockWs();
      const clientWs = createMockWs();
      const inviteCode = roomManager.createRoom(hostWs, 25565);
      roomManager.joinRoom(inviteCode, clientWs);

      roomManager.removeClientFromRoom(inviteCode, clientWs);

      const room = roomManager.getRoom(inviteCode);
      expect(room!.clients).toHaveLength(0);
      expect(room!.status).toBe(RoomStatus.WaitingForClient);
    });
  });

  describe('cleanupExpiredRooms', () => {
    it('should remove expired rooms', () => {
      const manager = new RoomManager(100, 0); // 0ms timeout (immediately expired)
      const inviteCode = manager.createRoom(createMockWs(), 25565);

      manager.cleanupExpiredRooms();

      expect(manager.getRoom(inviteCode)).toBeUndefined();
    });
  });

  describe('counts', () => {
    it('should return correct room count', () => {
      expect(roomManager.getRoomCount()).toBe(0);
      roomManager.createRoom(createMockWs(), 25565);
      expect(roomManager.getRoomCount()).toBe(1);
    });

    it('should return correct connection count', () => {
      const inviteCode = roomManager.createRoom(createMockWs(), 25565);
      expect(roomManager.getConnectionCount()).toBe(1);

      roomManager.joinRoom(inviteCode, createMockWs());
      expect(roomManager.getConnectionCount()).toBe(2);
    });
  });
});
