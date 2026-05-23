# Development Guide

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Minecraft     │         │   Relay Server   │         │   Minecraft     │
│   (LAN World)   │         │   (WebSocket)    │         │   (Client)      │
│                 │         │                  │         │                 │
│  localhost:PORT ◄───TCP───┤  Host App        │         │                 │
│                 │         │    ▲             │         │                 │
└─────────────────┘         │    │ WebSocket   │         └────────┬────────┘
                            │    ▼             │                   │
                            │  ┌───────────┐  │                   │ TCP
                            │  │  Room      │  │                   │
                            │  │  Manager   │  │                   ▼
                            │  └───────────┘  │         ┌─────────────────┐
                            │    ▲             │         │   Client App    │
                            │    │ WebSocket   │         │                 │
                            │    ▼             │◄──WS───►│ localhost:25565 │
                            │  Client App     │         │                 │
                            └──────────────────┘         └─────────────────┘
```

**Data flow:**

1. Host opens Minecraft world to LAN (e.g., on port 54321)
2. Host app connects to relay via WebSocket, creates a room, gets invite code
3. Client app connects to relay via WebSocket, joins room with invite code
4. Client app starts a local TCP listener (e.g., port 25565)
5. Minecraft client connects to localhost:25565
6. Client app wraps TCP data into WebSocket messages, sends to relay
7. Relay forwards messages to host app
8. Host app opens TCP connection to Minecraft LAN world (localhost:54321)
9. Host app forwards the data to Minecraft, gets response
10. Response flows back: host app -> relay -> client app -> Minecraft client

## Packages

### `packages/shared`

Shared TypeScript types and constants used by all other packages.

- Protocol message types (enum `MessageType`)
- Message interfaces (`CreateRoomMessage`, `TunnelDataMessage`, etc.)
- Room status and error codes
- Constants (ports, timeouts, reconnect intervals)
- Invite code generation utility

### `packages/tunnel-core`

Core tunnel logic shared between the relay server and desktop app.

- Binary frame encoding/decoding (session ID + payload)
- `ReconnectionManager` class with exponential backoff

### `apps/relay-server`

Node.js server that acts as a message broker between host and client.

- HTTP server with `/health` endpoint
- WebSocket server at `/ws` path
- `RoomManager`: creates/joins/removes rooms, manages invite codes
- `RelayHandler`: routes WebSocket messages between host and clients
- Ping/pong health checks for connection liveness

### `apps/desktop`

Electron + React desktop application with dark gaming-style UI.

- **Main process** (`src/main/`): Electron window, IPC handlers, tunnel-host logic, tunnel-client logic, port detector, logger
- **Renderer process** (`src/renderer/`): React app with pages (Main, CreateRoom, JoinRoom, RoomHost, RoomClient, Settings, Logs), reusable components, Tailwind CSS styling

## Adding New Protocol Messages

1. Add a new entry to `MessageType` enum in `packages/shared/src/index.ts`
2. Define the message interface (e.g., `interface MyNewMessage`)
3. Add it to the `ProtocolMessage` union type
4. Handle it in `apps/relay-server/src/relay-handler.ts` (add case to `handleMessage`)
5. Handle it in desktop app main process if needed
6. Run `npm run build` to verify types

## Modifying the UI

The desktop app uses React with Tailwind CSS and a dark gaming theme.

1. Pages are in `apps/desktop/src/renderer/pages/`
2. Reusable components are in `apps/desktop/src/renderer/components/`
3. Global styles and CSS variables are in `apps/desktop/src/renderer/styles/globals.css`
4. Tailwind config is in `apps/desktop/tailwind.config.js`
5. IPC communication hooks are in `apps/desktop/src/renderer/hooks/useIpc.ts`

To add a new page:
1. Create `apps/desktop/src/renderer/pages/MyPage.tsx`
2. Add route in `apps/desktop/src/renderer/App.tsx`
3. Add navigation link in `NavBar.tsx` if needed

## Testing Strategy

### Unit Tests

- Framework: vitest (configured at root level)
- Location: `src/__tests__/` directories within each package
- Run: `npm test`

### Integration Test

- Script: `scripts/test-integration.ts`
- Run: `npm run test:integration`
- What it does: starts a real relay server, simulates host and client WebSocket connections, creates a TCP tunnel, and verifies data flows end-to-end

### Manual Testing

1. Start relay: `npm run server`
2. Start desktop app: `npm run desktop`
3. Create a room, join from another instance
4. Open Minecraft LAN world, verify tunnel works

## Build Pipeline

```
npm run build
  ├── packages/shared       (tsc -> dist/)
  ├── packages/tunnel-core  (tsc -> dist/)
  ├── apps/relay-server     (tsc -> dist/)
  └── apps/desktop          (tsc + vite -> dist/, dist-main/)
```

The build order matters because workspace packages depend on each other:
- `tunnel-core` depends on `shared`
- `relay-server` depends on `shared` and `tunnel-core`
- `desktop` depends on `shared` and `tunnel-core`

npm workspaces resolves these dependencies via the `*` version specifier in package.json.

## Development Workflow

```bash
# Install all dependencies
npm install

# Build everything (required first time)
npm run build

# Start relay in dev mode (auto-restarts on changes)
npm run server

# Start desktop app in dev mode (hot reload for renderer)
npm run desktop

# Run tests
npm test

# Run integration test
npm run test:integration
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make changes following existing code patterns
4. Ensure `npm run build` and `npm test` pass
5. Commit with descriptive message
6. Open a pull request
