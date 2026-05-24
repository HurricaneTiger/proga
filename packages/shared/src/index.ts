// Protocol message types

export enum MessageType {
  CreateRoom = 'create_room',
  JoinRoom = 'join_room',
  RoomCreated = 'room_created',
  RoomJoined = 'room_joined',
  TunnelStart = 'tunnel_start',
  TunnelData = 'tunnel_data',
  TunnelClose = 'tunnel_close',
  Error = 'error',
  HealthCheck = 'health_check',
  StatusUpdate = 'status_update',
}

export enum RoomStatus {
  WaitingForClient = 'waiting_for_client',
  Connected = 'connected',
  Closed = 'closed',
}

export enum ErrorCode {
  RoomNotFound = 'room_not_found',
  RoomFull = 'room_full',
  InvalidInviteCode = 'invalid_invite_code',
  InvalidMessage = 'invalid_message',
  InternalError = 'internal_error',
  RoomClosed = 'room_closed',
  ConnectionFailed = 'connection_failed',
}

// Protocol message interfaces

export interface CreateRoomMessage {
  type: MessageType.CreateRoom;
  minecraftPort: number;
}

export interface JoinRoomMessage {
  type: MessageType.JoinRoom;
  inviteCode: string;
}

export interface RoomCreatedMessage {
  type: MessageType.RoomCreated;
  inviteCode: string;
}

export interface RoomJoinedMessage {
  type: MessageType.RoomJoined;
  inviteCode: string;
}

export interface TunnelStartMessage {
  type: MessageType.TunnelStart;
  sessionId: string;
}

export interface TunnelDataMessage {
  type: MessageType.TunnelData;
  sessionId: string;
  data: string; // base64 encoded binary data
}

export interface TunnelCloseMessage {
  type: MessageType.TunnelClose;
  sessionId: string;
}

export interface ErrorMessage {
  type: MessageType.Error;
  code: ErrorCode;
  message: string;
}

export interface HealthCheckMessage {
  type: MessageType.HealthCheck;
}

export interface StatusUpdateMessage {
  type: MessageType.StatusUpdate;
  roomStatus: RoomStatus;
  clientCount: number;
}

export type ProtocolMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | RoomCreatedMessage
  | RoomJoinedMessage
  | TunnelStartMessage
  | TunnelDataMessage
  | TunnelCloseMessage
  | ErrorMessage
  | HealthCheckMessage
  | StatusUpdateMessage;

// Constants

export const DEFAULT_RELAY_PORT = 3000;
export const DEFAULT_WS_PATH = '/ws';
export const DEFAULT_MINECRAFT_PORT = 25565;
export const PUBLIC_RELAY_URL = 'wss://mc-lan-tunnel.onrender.com';
export const MAX_ROOMS = 100;
export const ROOM_TIMEOUT_MS = 3600000; // 1 hour
export const RECONNECT_INTERVAL_MS = 1000;
export const MAX_RECONNECT_INTERVAL_MS = 30000;
export const RECONNECT_MULTIPLIER = 2;

// Invite code generation

import { randomBytes } from 'crypto';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS.charAt(bytes[i] % INVITE_CODE_CHARS.length);
  }
  return code;
}
