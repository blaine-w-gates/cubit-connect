/**
 * E2EE Runtime Verification Tests
 *
 * Verifies that encryption/decryption actually works with real data.
 *
 * @module e2eeRuntime.test
 * @runtime-verification
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as Y from 'yjs';
import { encryptUpdate, decryptUpdate } from '@/lib/cryptoSync';

// ============================================================================
// KEY DERIVATION (For Testing)
// ============================================================================

async function deriveTestKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('test-salt-fixed'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('E2EE Runtime Verification', () => {
  let derivedKey: CryptoKey;
  let wrongKey: CryptoKey;

  beforeAll(async () => {
    derivedKey = await deriveTestKey('test-passphrase');
    wrongKey = await deriveTestKey('wrong-passphrase');
  });

  // ============================================================================
  // C2: E2EE Actually Encrypts
  // ============================================================================

  describe('C2: E2EE Actually Encrypts', () => {
    it('should encrypt Yjs updates to non-plaintext', async () => {
      // Create Yjs document with test data
      const ydoc = new Y.Doc({ gc: false });
      const ymap = ydoc.getMap('test');
      ymap.set('message', 'Hello, Encrypted World!');
      ymap.set('number', 42);

      // Encode state as update
      const update = Y.encodeStateAsUpdate(ydoc);

      // Verify plaintext contains readable data
      const plaintext = new TextDecoder().decode(update);
      expect(plaintext).toContain('Hello, Encrypted World!');

      // Encrypt the update
      const encrypted = await encryptUpdate(update, derivedKey);

      // Verify encrypted data is different from plaintext
      const encryptedText = new TextDecoder().decode(encrypted);
      expect(encryptedText).not.toContain('Hello, Encrypted World!');

      // Verify encrypted data is not human-readable
      expect(encrypted.length).toBeGreaterThan(0);

      // Cleanup
      ydoc.destroy();
    });

    it('should decrypt to original data', async () => {
      // Create Yjs document
      const ydoc1 = new Y.Doc({ gc: false });
      const ymap1 = ydoc1.getMap('test');
      ymap1.set('data', 'Secret Message');
      ymap1.set('array', [1, 2, 3]);

      // Encode
      const originalUpdate = Y.encodeStateAsUpdate(ydoc1);

      // Encrypt
      const encrypted = await encryptUpdate(originalUpdate, derivedKey);

      // Decrypt
      const decrypted = await decryptUpdate(encrypted, derivedKey);

      // Verify decrypted equals original
      expect(decrypted).toEqual(originalUpdate);

      // Create new Yjs doc from decrypted data
      const ydoc2 = new Y.Doc({ gc: false });
      Y.applyUpdate(ydoc2, decrypted, 'remote');

      // Verify data integrity
      const ymap2 = ydoc2.getMap('test');
      expect(ymap2.get('data')).toBe('Secret Message');
      expect(ymap2.get('array')).toEqual([1, 2, 3]);

      // Cleanup
      ydoc1.destroy();
      ydoc2.destroy();
    });

    it('should fail decryption with wrong key', async () => {
      // Create and encrypt data
      const ydoc = new Y.Doc({ gc: false });
      ydoc.getMap('test').set('secret', 'value');

      const update = Y.encodeStateAsUpdate(ydoc);
      const encrypted = await encryptUpdate(update, derivedKey);

      // Attempt decryption with wrong key
      await expect(decryptUpdate(encrypted, wrongKey)).rejects.toThrow();

      // Cleanup
      ydoc.destroy();
    });

    it('should produce different ciphertext for same data with different IVs', async () => {
      // Create Yjs document
      const ydoc = new Y.Doc({ gc: false });
      ydoc.getMap('test').set('data', 'Consistent Data');

      const update = Y.encodeStateAsUpdate(ydoc);

      // Encrypt twice with same key (should use different IVs)
      const encrypted1 = await encryptUpdate(update, derivedKey);
      const encrypted2 = await encryptUpdate(update, derivedKey);

      // Verify different ciphertexts (due to random IV)
      expect(encrypted1).not.toEqual(encrypted2);

      // But both should decrypt to same data
      const decrypted1 = await decryptUpdate(encrypted1, derivedKey);
      const decrypted2 = await decryptUpdate(encrypted2, derivedKey);
      expect(decrypted1).toEqual(decrypted2);
      expect(decrypted1).toEqual(update);

      // Cleanup
      ydoc.destroy();
    });

    it('should handle large updates', async () => {
      // Create large Yjs document
      const ydoc = new Y.Doc({ gc: false });
      const ytext = ydoc.getText('large');

      // Insert 10KB of text
      const largeText = 'A'.repeat(10000);
      ytext.insert(0, largeText);

      const update = Y.encodeStateAsUpdate(ydoc);
      expect(update.length).toBeGreaterThan(10000);

      // Encrypt
      const encrypted = await encryptUpdate(update, derivedKey);

      // Decrypt
      const decrypted = await decryptUpdate(encrypted, derivedKey);

      // Verify integrity
      expect(decrypted).toEqual(update);

      // Verify can apply to new document
      const ydoc2 = new Y.Doc({ gc: false });
      Y.applyUpdate(ydoc2, decrypted, 'remote');
      const ytext2 = ydoc2.getText('large');
      expect(ytext2.toString()).toBe(largeText);

      // Cleanup
      ydoc.destroy();
      ydoc2.destroy();
    });

    it('should handle binary data', async () => {
      // Create document with binary-like content
      const ydoc = new Y.Doc({ gc: false });
      const ymap = ydoc.getMap('binary-test');

      // Store binary data as base64
      const binaryData = new Uint8Array([0, 1, 2, 255, 254, 253]);
      ymap.set('binary', Array.from(binaryData));

      const update = Y.encodeStateAsUpdate(ydoc);

      // Encrypt
      const encrypted = await encryptUpdate(update, derivedKey);

      // Decrypt
      const decrypted = await decryptUpdate(encrypted, derivedKey);

      // Verify
      expect(decrypted).toEqual(update);

      // Cleanup
      ydoc.destroy();
    });
  });

  // ============================================================================
  // Integration: E2EE + Yjs
  // ============================================================================

  describe('E2EE + Yjs Integration', () => {
    it('should encrypt Yjs updates in real-time scenario', async () => {
      // Simulate real-time collaborative editing
      const ydoc = new Y.Doc({ gc: false });
      const ytext = ydoc.getText('collaborative');

      // User types
      ytext.insert(0, 'Hello');
      const update1 = Y.encodeStateAsUpdate(ydoc);

      ytext.insert(5, ' World');
      const update2 = Y.encodeStateAsUpdate(ydoc);

      // Encrypt both updates
      const encrypted1 = await encryptUpdate(update1, derivedKey);
      const encrypted2 = await encryptUpdate(update2, derivedKey);

      // Verify both encrypted
      expect(encrypted1.length).toBeGreaterThan(0);
      expect(encrypted2.length).toBeGreaterThan(0);
      expect(encrypted1).not.toEqual(encrypted2);

      // Decrypt and verify
      const decrypted1 = await decryptUpdate(encrypted1, derivedKey);
      const decrypted2 = await decryptUpdate(encrypted2, derivedKey);

      // Apply decrypted updates to fresh document
      const ydoc2 = new Y.Doc({ gc: false });
      Y.applyUpdate(ydoc2, decrypted1, 'remote');
      Y.applyUpdate(ydoc2, decrypted2, 'remote');

      // Verify final state
      expect(ydoc2.getText('collaborative').toString()).toBe('Hello World');

      // Cleanup
      ydoc.destroy();
      ydoc2.destroy();
    });
  });
});

// ============================================================================
// VERIFICATION SUMMARY
// ============================================================================

/**
 * These tests verify:
 *
 * ✅ C2: E2EE Actually Encrypts
 *    - Encryption produces non-plaintext output
 *    - Same data produces different ciphertexts (IV randomization)
 *    - Large updates handled correctly
 *    - Binary data preserved
 *
 * ✅ Decryption Integrity
 *    - Decrypted data equals original
 *    - Wrong keys fail decryption
 *    - Multiple updates handled correctly
 *
 * ✅ Real-time Scenario
 *    - Simulates collaborative editing
 *    - Multiple updates encrypt/decrypt correctly
 */
