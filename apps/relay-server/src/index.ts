import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { DEFAULT_RELAY_PORT, DEFAULT_WS_PATH } from '@minecraft-lan-tunnel/shared';
import { RoomManager } from './room-manager.js';
import { RelayHandler } from './relay-handler.js';
import { handleHealthRequest, setupPingPong } from './health.js';

dotenv.config();

const PORT = parseInt(process.env.RELAY_PORT || String(DEFAULT_RELAY_PORT), 10);
const WS_PATH = process.env.WS_PATH || DEFAULT_WS_PATH;
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '100', 10);
const ROOM_TIMEOUT_MS = parseInt(process.env.ROOM_TIMEOUT_MS || '3600000', 10);

const roomManager = new RoomManager(MAX_ROOMS, ROOM_TIMEOUT_MS);
const relayHandler = new RelayHandler(roomManager);

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    handleHealthRequest(req, res, roomManager);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on('connection', (ws) => {
  relayHandler.handleConnection(ws);
});

const cleanupPingPong = setupPingPong(wss);

// Cleanup expired rooms periodically
const cleanupInterval = setInterval(() => {
  roomManager.cleanupExpiredRooms();
}, 60000);

server.listen(PORT, () => {
  console.log(`Relay server running on port ${PORT}`);
  console.log(`WebSocket path: ${WS_PATH}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  cleanupPingPong();
  wss.close();
  server.close();
});

export { server, wss, roomManager };
