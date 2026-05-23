import {
  RECONNECT_INTERVAL_MS,
  MAX_RECONNECT_INTERVAL_MS,
  RECONNECT_MULTIPLIER,
} from '@minecraft-lan-tunnel/shared';

/**
 * Binary message framing for tunnel data.
 *
 * Frame format:
 *   1 byte  - message type (0x01 = tunnel data)
 *   4 bytes - session ID length (big-endian uint32)
 *   N bytes - session ID (UTF-8)
 *   rest    - payload
 */

export const FRAME_TYPE_TUNNEL_DATA = 0x01;
export const FRAME_TYPE_TUNNEL_CLOSE = 0x02;

export function encodeFrame(
  type: number,
  sessionId: string,
  payload?: Uint8Array
): Uint8Array {
  const sessionIdBytes = new TextEncoder().encode(sessionId);
  const sessionIdLength = sessionIdBytes.length;
  const payloadLength = payload ? payload.length : 0;

  const frame = new Uint8Array(1 + 4 + sessionIdLength + payloadLength);
  const view = new DataView(frame.buffer);

  frame[0] = type;
  view.setUint32(1, sessionIdLength, false); // big-endian
  frame.set(sessionIdBytes, 5);

  if (payload) {
    frame.set(payload, 5 + sessionIdLength);
  }

  return frame;
}

export interface DecodedFrame {
  type: number;
  sessionId: string;
  payload: Uint8Array;
}

export function decodeFrame(data: Uint8Array): DecodedFrame {
  if (data.length < 5) {
    throw new Error('Frame too short: must be at least 5 bytes');
  }

  const type = data[0];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sessionIdLength = view.getUint32(1, false); // big-endian

  if (data.length < 5 + sessionIdLength) {
    throw new Error('Frame too short: session ID extends beyond frame');
  }

  const sessionIdBytes = data.slice(5, 5 + sessionIdLength);
  const sessionId = new TextDecoder().decode(sessionIdBytes);
  const payload = data.slice(5 + sessionIdLength);

  return { type, sessionId, payload };
}

/**
 * Reconnection logic with exponential backoff.
 */
export class ReconnectionManager {
  private attempt = 0;
  private currentInterval: number;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly baseInterval = RECONNECT_INTERVAL_MS,
    private readonly maxInterval = MAX_RECONNECT_INTERVAL_MS,
    private readonly multiplier = RECONNECT_MULTIPLIER
  ) {
    this.currentInterval = baseInterval;
  }

  /**
   * Schedule the next reconnection attempt.
   * Returns a promise that resolves after the backoff delay.
   */
  scheduleReconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(() => {
        this.attempt++;
        this.currentInterval = Math.min(
          this.currentInterval * this.multiplier,
          this.maxInterval
        );
        resolve();
      }, this.currentInterval);
    });
  }

  /**
   * Reset the backoff state after a successful connection.
   */
  reset(): void {
    this.attempt = 0;
    this.currentInterval = this.baseInterval;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Cancel any pending reconnection.
   */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getAttempt(): number {
    return this.attempt;
  }

  getCurrentInterval(): number {
    return this.currentInterval;
  }
}
