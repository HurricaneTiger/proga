import { describe, it, expect } from 'vitest';
import {
  encodeFrame,
  decodeFrame,
  FRAME_TYPE_TUNNEL_DATA,
  FRAME_TYPE_TUNNEL_CLOSE,
} from '../index.js';

describe('Message Framing', () => {
  describe('encodeFrame', () => {
    it('should encode a frame with payload', () => {
      const sessionId = 'abc123';
      const payload = new Uint8Array([0x01, 0x02, 0x03]);

      const frame = encodeFrame(FRAME_TYPE_TUNNEL_DATA, sessionId, payload);

      // 1 byte type + 4 bytes session ID length + 6 bytes session ID + 3 bytes payload = 14
      expect(frame.length).toBe(14);
      expect(frame[0]).toBe(FRAME_TYPE_TUNNEL_DATA);
    });

    it('should encode a frame without payload', () => {
      const sessionId = 'test';
      const frame = encodeFrame(FRAME_TYPE_TUNNEL_CLOSE, sessionId);

      // 1 byte type + 4 bytes session ID length + 4 bytes session ID = 9
      expect(frame.length).toBe(9);
      expect(frame[0]).toBe(FRAME_TYPE_TUNNEL_CLOSE);
    });
  });

  describe('decodeFrame', () => {
    it('should decode a frame encoded with encodeFrame', () => {
      const sessionId = 'session-42';
      const payload = new Uint8Array([0xFF, 0x00, 0xAB, 0xCD]);

      const frame = encodeFrame(FRAME_TYPE_TUNNEL_DATA, sessionId, payload);
      const decoded = decodeFrame(frame);

      expect(decoded.type).toBe(FRAME_TYPE_TUNNEL_DATA);
      expect(decoded.sessionId).toBe(sessionId);
      expect(decoded.payload).toEqual(payload);
    });

    it('should decode a frame without payload', () => {
      const sessionId = 'close-session';
      const frame = encodeFrame(FRAME_TYPE_TUNNEL_CLOSE, sessionId);
      const decoded = decodeFrame(frame);

      expect(decoded.type).toBe(FRAME_TYPE_TUNNEL_CLOSE);
      expect(decoded.sessionId).toBe(sessionId);
      expect(decoded.payload.length).toBe(0);
    });

    it('should throw on frame too short', () => {
      const shortFrame = new Uint8Array([0x01, 0x00]);
      expect(() => decodeFrame(shortFrame)).toThrow('Frame too short');
    });

    it('should throw when session ID extends beyond frame', () => {
      // Type + length saying 100 bytes for session ID but frame is only 5 bytes
      const frame = new Uint8Array(5);
      frame[0] = 0x01;
      const view = new DataView(frame.buffer);
      view.setUint32(1, 100, false);

      expect(() => decodeFrame(frame)).toThrow(
        'Frame too short: session ID extends beyond frame'
      );
    });

    it('should handle large payloads', () => {
      const sessionId = 'big-data';
      const payload = new Uint8Array(1024);
      for (let i = 0; i < payload.length; i++) {
        payload[i] = i % 256;
      }

      const frame = encodeFrame(FRAME_TYPE_TUNNEL_DATA, sessionId, payload);
      const decoded = decodeFrame(frame);

      expect(decoded.payload.length).toBe(1024);
      expect(decoded.payload).toEqual(payload);
    });

    it('should handle empty session ID', () => {
      const sessionId = '';
      const payload = new Uint8Array([0x42]);

      const frame = encodeFrame(FRAME_TYPE_TUNNEL_DATA, sessionId, payload);
      const decoded = decodeFrame(frame);

      expect(decoded.sessionId).toBe('');
      expect(decoded.payload).toEqual(payload);
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through encode/decode cycle', () => {
      const testCases = [
        { type: FRAME_TYPE_TUNNEL_DATA, sessionId: 'a', payload: new Uint8Array([1]) },
        { type: FRAME_TYPE_TUNNEL_CLOSE, sessionId: 'long-session-id-12345', payload: new Uint8Array(0) },
        { type: FRAME_TYPE_TUNNEL_DATA, sessionId: 'unicode-ok', payload: new Uint8Array(512).fill(0xAA) },
      ];

      for (const tc of testCases) {
        const frame = encodeFrame(tc.type, tc.sessionId, tc.payload);
        const decoded = decodeFrame(frame);

        expect(decoded.type).toBe(tc.type);
        expect(decoded.sessionId).toBe(tc.sessionId);
        expect(decoded.payload).toEqual(tc.payload);
      }
    });
  });
});
