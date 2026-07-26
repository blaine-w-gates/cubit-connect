/**
 * Unit Tests for CheckpointService BYTEA Hex Encoding/Decoding
 *
 * Tests the hex encoding/decoding logic used for PostgreSQL BYTEA columns
 * without requiring a live Supabase connection.
 *
 * @module checkpointService.test
 * @unit
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// HEX ENCODING/DECODING UTILITIES (extracted from checkpointService.ts logic)
// ============================================================================

function encodeToHex(data: Uint8Array): string {
  return '\\x' + (typeof Buffer !== 'undefined'
    ? Buffer.from(data).toString('hex')
    : Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(''));
}

function decodeFromHex(hexStr: string): Uint8Array {
  const stripped = hexStr.startsWith('\\x') ? hexStr.slice(2) : hexStr;
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(stripped, 'hex'));
  } else {
    const bytes = new Uint8Array(stripped.length / 2);
    for (let i = 0; i < stripped.length; i += 2) {
      bytes[i / 2] = parseInt(stripped.substr(i, 2), 16);
    }
    return bytes;
  }
}

function decodeFromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  } else {
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

function decodeRawData(rawData: unknown): Uint8Array {
  if (typeof rawData === 'string') {
    if (rawData.startsWith('\\x')) {
      return decodeFromHex(rawData);
    } else {
      return decodeFromBase64(rawData);
    }
  } else if (rawData instanceof ArrayBuffer) {
    return new Uint8Array(rawData);
  } else if (rawData instanceof Uint8Array) {
    return rawData;
  } else if (rawData && typeof rawData === 'object' && 'data' in rawData) {
    return new Uint8Array((rawData as { data: number[] }).data);
  } else {
    return new Uint8Array(rawData as ArrayBuffer);
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('CheckpointService BYTEA Encoding', () => {
  describe('hex encoding', () => {
    it('should encode empty Uint8Array to \\x prefix only', () => {
      const data = new Uint8Array(0);
      const encoded = encodeToHex(data);
      expect(encoded).toBe('\\x');
    });

    it('should encode single byte correctly', () => {
      const data = new Uint8Array([0x42]);
      const encoded = encodeToHex(data);
      expect(encoded).toBe('\\x42');
    });

    it('should encode multi-byte data correctly', () => {
      const data = new Uint8Array([0x00, 0xff, 0xab, 0x01, 0x80]);
      const encoded = encodeToHex(data);
      expect(encoded).toBe('\\x00ffab0180');
    });

    it('should always prefix with \\x', () => {
      const data = new Uint8Array([0x01]);
      const encoded = encodeToHex(data);
      expect(encoded.startsWith('\\x')).toBe(true);
    });
  });

  describe('hex decoding', () => {
    it('should decode \\x prefix only to empty Uint8Array', () => {
      const decoded = decodeFromHex('\\x');
      expect(decoded.length).toBe(0);
    });

    it('should decode single byte hex correctly', () => {
      const decoded = decodeFromHex('\\x42');
      expect(decoded).toEqual(new Uint8Array([0x42]));
    });

    it('should decode multi-byte hex correctly', () => {
      const decoded = decodeFromHex('\\x00ffab0180');
      expect(decoded).toEqual(new Uint8Array([0x00, 0xff, 0xab, 0x01, 0x80]));
    });

    it('should handle hex without \\x prefix', () => {
      const decoded = decodeFromHex('deadbeef');
      expect(decoded).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });
  });

  describe('hex round-trip', () => {
    it('should round-trip empty data', () => {
      const original = new Uint8Array(0);
      const encoded = encodeToHex(original);
      const decoded = decodeFromHex(encoded);
      expect(decoded).toEqual(original);
    });

    it('should round-trip small data', () => {
      const original = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const encoded = encodeToHex(original);
      const decoded = decodeFromHex(encoded);
      expect(decoded).toEqual(original);
    });

    it('should round-trip large data (1000 bytes)', () => {
      const original = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) {
        original[i] = (i * 37 + 13) & 0xff;
      }
      const encoded = encodeToHex(original);
      const decoded = decodeFromHex(encoded);
      expect(decoded).toEqual(original);
    });

    it('should round-trip all byte values (0-255)', () => {
      const original = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        original[i] = i;
      }
      const encoded = encodeToHex(original);
      const decoded = decodeFromHex(encoded);
      expect(decoded).toEqual(original);
    });

    it('should round-trip Yjs-like binary data', () => {
      // Simulate a Yjs document update (binary format)
      const original = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
      ]);
      const encoded = encodeToHex(original);
      const decoded = decodeFromHex(encoded);
      expect(decoded).toEqual(original);
    });
  });
});

describe('CheckpointService Raw Data Decoding', () => {
  it('should decode hex string with \\x prefix', () => {
    const rawData = '\\x48656c6c6f';
    const decoded = decodeRawData(rawData);
    expect(decoded).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('should decode base64 string', () => {
    // "Hello" in base64
    const rawData = 'SGVsbG8=';
    const decoded = decodeRawData(rawData);
    expect(decoded).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  it('should decode ArrayBuffer', () => {
    const buffer = new ArrayBuffer(5);
    const view = new Uint8Array(buffer);
    view.set([1, 2, 3, 4, 5]);
    const decoded = decodeRawData(buffer);
    expect(decoded).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('should decode Uint8Array directly', () => {
    const data = new Uint8Array([10, 20, 30]);
    const decoded = decodeRawData(data);
    expect(decoded).toEqual(data);
  });

  it('should decode Buffer object format { type: "Buffer", data: number[] }', () => {
    const rawData = { type: 'Buffer', data: [0x01, 0x02, 0x03] };
    const decoded = decodeRawData(rawData);
    expect(decoded).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
  });

  it('should handle empty hex string', () => {
    const decoded = decodeRawData('\\x');
    expect(decoded.length).toBe(0);
  });
});

describe('CheckpointService Encoding vs Base64', () => {
  it('hex encoding should produce different output than base64', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const hexEncoded = encodeToHex(data);
    const b64Encoded = Buffer.from(data).toString('base64');
    expect(hexEncoded).not.toBe(b64Encoded);
    expect(hexEncoded.startsWith('\\x')).toBe(true);
  });

  it('hex encoding should be larger than base64 (2x vs 1.33x)', () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;
    const hexEncoded = encodeToHex(data);
    const b64Encoded = Buffer.from(data).toString('base64');
    // Hex is 2x original size + 2 for \x prefix = 202
    // Base64 is ~1.33x = ~136
    expect(hexEncoded.length).toBeGreaterThan(b64Encoded.length);
  });

  it('both formats should decode to same result', () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const hexDecoded = decodeFromHex(encodeToHex(original));
    const b64Decoded = decodeFromBase64(Buffer.from(original).toString('base64'));
    expect(hexDecoded).toEqual(original);
    expect(b64Decoded).toEqual(original);
    expect(hexDecoded).toEqual(b64Decoded);
  });
});
