import type { IncomingMessage, ServerResponse } from 'http';
import type { WebSocketServer } from 'ws';
import type { RoomManager } from './room-manager.js';

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  rooms: number;
  connections: number;
}

export function handleHealthRequest(
  _req: IncomingMessage,
  res: ServerResponse,
  roomManager: RoomManager
): void {
  const health: HealthResponse = {
    status: 'ok',
    uptime: process.uptime(),
    rooms: roomManager.getRoomCount(),
    connections: roomManager.getConnectionCount(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health));
}

export function setupPingPong(wss: WebSocketServer, intervalMs = 30000): () => void {
  const aliveMap = new WeakMap<object, boolean>();

  wss.on('connection', (ws) => {
    aliveMap.set(ws, true);
    ws.on('pong', () => {
      aliveMap.set(ws, true);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (aliveMap.get(ws) === false) {
        ws.terminate();
        return;
      }
      aliveMap.set(ws, false);
      ws.ping();
    });
  }, intervalMs);

  return () => clearInterval(interval);
}
