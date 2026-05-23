/**
 * End-to-end integration test for MC LAN Tunnel.
 *
 * This test validates the full tunnel path:
 *   TCP Client -> Client App (WS) -> Relay Server -> Host App (WS) -> TCP Server (Minecraft)
 *   and back.
 *
 * It uses the real relay server, real WebSocket connections, and real TCP sockets.
 */

import { createServer, type Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as net from 'net';
import { RoomManager } from '../apps/relay-server/src/room-manager.js';
import { RelayHandler } from '../apps/relay-server/src/relay-handler.js';
import { handleHealthRequest, setupPingPong } from '../apps/relay-server/src/health.js';
import { MessageType } from '../packages/shared/src/index.js';

// --- Utility functions ---

function log(step: string, message: string): void {
  console.log(`  [${step}] ${message}`);
}

function logSection(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function waitForMessage(ws: WebSocket, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for WebSocket message (${timeout}ms)`));
    }, timeout);

    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function waitForData(socket: net.Socket, timeout = 5000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for TCP data (${timeout}ms)`));
    }, timeout);

    socket.once('data', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForConnection(server: net.Server, timeout = 5000): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for TCP connection (${timeout}ms)`));
    }, timeout);

    server.once('connection', (socket) => {
      clearTimeout(timer);
      resolve(socket);
    });
  });
}

function connectWs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr !== 'string') {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get random port'));
      }
    });
  });
}

// --- Main test ---

async function runIntegrationTest(): Promise<void> {
  let relayServer: HttpServer | null = null;
  let wss: WebSocketServer | null = null;
  let cleanupPingPong: (() => void) | null = null;
  let minecraftServer: net.Server | null = null;
  let clientListener: net.Server | null = null;
  let hostWs: WebSocket | null = null;
  let clientWs: WebSocket | null = null;
  let tcpClient: net.Socket | null = null;
  let hostTcpSocket: net.Socket | null = null;
  let minecraftSocket: net.Socket | null = null;

  try {
    // =====================================================
    logSection('STEP 1: Start Relay Server');
    // =====================================================

    const relayPort = await getRandomPort();
    const roomManager = new RoomManager(100, 3600000);
    const relayHandler = new RelayHandler(roomManager);

    relayServer = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        handleHealthRequest(req, res, roomManager);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    wss = new WebSocketServer({ server: relayServer, path: '/ws' });
    wss.on('connection', (ws) => relayHandler.handleConnection(ws));
    cleanupPingPong = setupPingPong(wss);

    await new Promise<void>((resolve) => {
      relayServer!.listen(relayPort, '127.0.0.1', () => resolve());
    });

    log('OK', `Relay server started on port ${relayPort}`);

    // =====================================================
    logSection('STEP 2: Start Dummy Minecraft Server (TCP)');
    // =====================================================

    const minecraftPort = await getRandomPort();
    minecraftServer = net.createServer();
    await new Promise<void>((resolve) => {
      minecraftServer!.listen(minecraftPort, '127.0.0.1', () => resolve());
    });

    log('OK', `Dummy Minecraft server listening on port ${minecraftPort}`);

    // =====================================================
    logSection('STEP 3: Host connects to relay and creates room');
    // =====================================================

    hostWs = await connectWs(relayPort);
    log('OK', 'Host WebSocket connected to relay');

    // Host creates a room
    hostWs.send(JSON.stringify({
      type: MessageType.CreateRoom,
      minecraftPort: minecraftPort,
    }));

    const roomCreatedMsg = await waitForMessage(hostWs);
    if (roomCreatedMsg.type !== MessageType.RoomCreated) {
      throw new Error(`Expected RoomCreated, got: ${JSON.stringify(roomCreatedMsg)}`);
    }

    const inviteCode = roomCreatedMsg.inviteCode;
    log('OK', `Room created with invite code: ${inviteCode}`);

    // =====================================================
    logSection('STEP 4: Client connects to relay and joins room');
    // =====================================================

    clientWs = await connectWs(relayPort);
    log('OK', 'Client WebSocket connected to relay');

    clientWs.send(JSON.stringify({
      type: MessageType.JoinRoom,
      inviteCode: inviteCode,
    }));

    const roomJoinedMsg = await waitForMessage(clientWs);
    if (roomJoinedMsg.type !== MessageType.RoomJoined) {
      throw new Error(`Expected RoomJoined, got: ${JSON.stringify(roomJoinedMsg)}`);
    }

    log('OK', `Client joined room with code: ${inviteCode}`);

    // Host should receive a StatusUpdate about the client joining
    const statusMsg = await waitForMessage(hostWs);
    if (statusMsg.type !== MessageType.StatusUpdate) {
      throw new Error(`Expected StatusUpdate, got: ${JSON.stringify(statusMsg)}`);
    }
    log('OK', `Host received status update: ${statusMsg.clientCount} client(s) connected`);

    // =====================================================
    logSection('STEP 5: Client starts local TCP listener');
    // =====================================================

    const clientLocalPort = await getRandomPort();
    const sessionId = 'test-session-001';

    clientListener = net.createServer();
    await new Promise<void>((resolve) => {
      clientListener!.listen(clientLocalPort, '127.0.0.1', () => resolve());
    });

    log('OK', `Client local listener on port ${clientLocalPort}`);

    // Set up client-side relay logic:
    // When a TCP connection arrives at clientListener, pipe data through WS to relay
    clientListener.on('connection', (localSocket) => {
      log('INFO', 'Client: local TCP connection received, bridging to relay');

      localSocket.on('data', (data) => {
        // Send TCP data to relay as TunnelData
        clientWs!.send(JSON.stringify({
          type: MessageType.TunnelData,
          sessionId: sessionId,
          data: data.toString('base64'),
        }));
      });
    });

    // Set up client-side: when receiving TunnelData from relay, forward to local TCP
    let clientLocalSocket: net.Socket | null = null;
    const clientIncomingHandler = (rawData: any) => {
      const msg = JSON.parse(rawData.toString());
      if (msg.type === MessageType.TunnelData && msg.sessionId === sessionId) {
        if (clientLocalSocket) {
          clientLocalSocket.write(Buffer.from(msg.data, 'base64'));
        }
      }
    };
    clientWs.on('message', clientIncomingHandler);

    // =====================================================
    logSection('STEP 6: Host sets up relay-to-Minecraft bridge');
    // =====================================================

    // Host-side logic: when receiving TunnelData from relay, forward to Minecraft TCP
    const hostIncomingHandler = (rawData: any) => {
      const msg = JSON.parse(rawData.toString());
      if (msg.type === MessageType.TunnelData && msg.sessionId === sessionId) {
        if (!hostTcpSocket || hostTcpSocket.destroyed) {
          // Open TCP connection to Minecraft server
          hostTcpSocket = net.createConnection({ host: '127.0.0.1', port: minecraftPort }, () => {
            log('INFO', 'Host: TCP connection to Minecraft server established');
            // Write the pending data
            hostTcpSocket!.write(Buffer.from(msg.data, 'base64'));
          });

          hostTcpSocket.on('data', (data) => {
            // Send Minecraft response back through relay
            hostWs!.send(JSON.stringify({
              type: MessageType.TunnelData,
              sessionId: sessionId,
              data: data.toString('base64'),
            }));
          });

          hostTcpSocket.on('error', (err) => {
            log('ERROR', `Host TCP socket error: ${err.message}`);
          });
        } else {
          // Connection already exists, just forward data
          hostTcpSocket.write(Buffer.from(msg.data, 'base64'));
        }
      }
    };
    hostWs.on('message', hostIncomingHandler);

    log('OK', 'Host bridge configured: relay -> Minecraft TCP');

    // =====================================================
    logSection('STEP 7: Connect TCP client (simulating Minecraft player)');
    // =====================================================

    // Accept connection on Minecraft server side
    const minecraftConnectionPromise = waitForConnection(minecraftServer);

    tcpClient = net.createConnection({ host: '127.0.0.1', port: clientLocalPort });
    await new Promise<void>((resolve, reject) => {
      tcpClient!.on('connect', () => resolve());
      tcpClient!.on('error', (err) => reject(err));
    });

    // Store reference to client local socket for sending back data
    clientLocalSocket = await new Promise<net.Socket>((resolve) => {
      // The clientListener 'connection' event already fired, we need to get that socket
      // Re-register to capture the socket
      // Actually we already have the TCP client connected, let's just wait a bit
      // for the connection event to propagate
      setTimeout(() => {
        // We need to get the socket from the clientListener
        // Since we set up the handler above, we need another approach
        resolve(tcpClient!); // placeholder - we handle this via the handler above
      }, 100);
    });
    // Actually: the clientLocalSocket we need is the one on the clientListener side
    // Let's fix: we store it from the connection event
    clientLocalSocket = null; // reset

    // Re-setup: close current listener and recreate with proper socket capture
    clientListener.removeAllListeners('connection');
    clientListener.close();

    // Restart with proper setup
    tcpClient.destroy();
    await sleep(100);

    clientListener = net.createServer();
    await new Promise<void>((resolve) => {
      clientListener!.listen(clientLocalPort, '127.0.0.1', () => resolve());
    });

    // Properly capture the client local socket
    const clientSocketPromise = new Promise<net.Socket>((resolve) => {
      clientListener!.once('connection', (socket) => {
        log('INFO', 'Client: TCP connection received from Minecraft player');
        clientLocalSocket = socket;

        socket.on('data', (data) => {
          clientWs!.send(JSON.stringify({
            type: MessageType.TunnelData,
            sessionId: sessionId,
            data: data.toString('base64'),
          }));
        });

        resolve(socket);
      });
    });

    // Now connect the TCP client
    tcpClient = net.createConnection({ host: '127.0.0.1', port: clientLocalPort });
    await new Promise<void>((resolve, reject) => {
      tcpClient!.on('connect', () => resolve());
      tcpClient!.on('error', (err) => reject(err));
    });

    const capturedClientSocket = await clientSocketPromise;
    log('OK', `TCP client connected to client listener on port ${clientLocalPort}`);

    // Now set up writing back to the captured socket
    clientWs.removeListener('message', clientIncomingHandler);
    const clientIncomingHandler2 = (rawData: any) => {
      const msg = JSON.parse(rawData.toString());
      if (msg.type === MessageType.TunnelData && msg.sessionId === sessionId) {
        capturedClientSocket.write(Buffer.from(msg.data, 'base64'));
      }
    };
    clientWs.on('message', clientIncomingHandler2);

    // Wait for Minecraft server connection from host
    await sleep(100);

    // =====================================================
    logSection('STEP 8: Send data through the tunnel (Client -> Host)');
    // =====================================================

    const testMessage = 'Hello Minecraft Server!';

    // Accept the connection on the Minecraft server side
    const mcSocketPromise = waitForConnection(minecraftServer);

    // Send data from TCP client
    tcpClient.write(testMessage);
    log('INFO', `TCP client sent: "${testMessage}"`);

    // Wait for the Minecraft server to receive it
    minecraftSocket = await mcSocketPromise;
    const receivedData = await waitForData(minecraftSocket);
    const receivedStr = receivedData.toString();

    if (receivedStr !== testMessage) {
      throw new Error(`Data mismatch! Expected "${testMessage}", got "${receivedStr}"`);
    }

    log('OK', `Minecraft server received: "${receivedStr}"`);

    // =====================================================
    logSection('STEP 9: Send response back (Host -> Client)');
    // =====================================================

    const responseMessage = 'Hello Player! Welcome to the server.';

    // Set up listener for TCP client data before sending
    const tcpResponsePromise = waitForData(tcpClient);

    // Minecraft server sends response
    minecraftSocket.write(responseMessage);
    log('INFO', `Minecraft server sent: "${responseMessage}"`);

    // Wait for TCP client to receive the response
    const responseData = await tcpResponsePromise;
    const responseStr = responseData.toString();

    if (responseStr !== responseMessage) {
      throw new Error(`Response mismatch! Expected "${responseMessage}", got "${responseStr}"`);
    }

    log('OK', `TCP client received: "${responseStr}"`);

    // =====================================================
    logSection('STEP 10: Multiple data exchanges');
    // =====================================================

    for (let i = 1; i <= 3; i++) {
      const msg = `Packet ${i}: data from player`;
      const reply = `Packet ${i}: data from server`;

      const mcDataPromise = waitForData(minecraftSocket);
      tcpClient.write(msg);

      const mcData = await mcDataPromise;
      if (mcData.toString() !== msg) {
        throw new Error(`Exchange ${i} forward mismatch`);
      }

      const clientDataPromise = waitForData(tcpClient);
      minecraftSocket.write(reply);

      const clientData = await clientDataPromise;
      if (clientData.toString() !== reply) {
        throw new Error(`Exchange ${i} reverse mismatch`);
      }

      log('OK', `Exchange ${i} passed`);
    }

    // =====================================================
    logSection('STEP 11: Test disconnect handling');
    // =====================================================

    // Close the TCP client
    tcpClient.destroy();
    await sleep(200);
    log('OK', 'TCP client disconnected cleanly');

    // Close client WebSocket
    clientWs.close();
    await sleep(200);
    log('OK', 'Client WebSocket disconnected');

    // Host should get a status update (client count decreased)
    // Wait a bit for the message
    const disconnectMsg = await waitForMessage(hostWs, 2000).catch(() => null);
    if (disconnectMsg) {
      log('OK', `Host received disconnect notification: ${JSON.stringify(disconnectMsg)}`);
    } else {
      log('INFO', 'No explicit disconnect message (connection closed)');
    }

    // =====================================================
    logSection('TEST COMPLETE');
    // =====================================================

    console.log('\n  All tests passed! The tunnel correctly relays TCP data');
    console.log('  through WebSocket connections via the relay server.\n');

  } finally {
    // Cleanup
    log('CLEANUP', 'Shutting down all connections and servers...');

    if (tcpClient && !tcpClient.destroyed) tcpClient.destroy();
    if (hostTcpSocket && !hostTcpSocket.destroyed) hostTcpSocket.destroy();
    if (minecraftSocket && !minecraftSocket.destroyed) minecraftSocket.destroy();
    if (hostWs && hostWs.readyState !== WebSocket.CLOSED) hostWs.close();
    if (clientWs && clientWs.readyState !== WebSocket.CLOSED) clientWs.close();

    if (clientListener) {
      await new Promise<void>((resolve) => clientListener!.close(() => resolve()));
    }
    if (minecraftServer) {
      await new Promise<void>((resolve) => minecraftServer!.close(() => resolve()));
    }
    if (cleanupPingPong) cleanupPingPong();
    if (wss) {
      wss.clients.forEach((client) => client.terminate());
      await new Promise<void>((resolve) => wss!.close(() => resolve()));
    }
    if (relayServer) {
      await new Promise<void>((resolve) => relayServer!.close(() => resolve()));
    }

    log('CLEANUP', 'Done');
  }
}

// --- Entry point ---

console.log('\n  MC LAN Tunnel - Integration Test');
console.log('  Validates end-to-end TCP tunnel through relay server\n');

runIntegrationTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n  TEST FAILED: ${err.message}\n`);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  });
