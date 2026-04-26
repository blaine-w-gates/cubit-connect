/**
 * cryptoSync.ts
 * 
 * Strict E2EE Web Crypto Implementation for Chunk 4.
 * Handles PBKDF2 key derivation and AES-GCM encryption/decryption of Yjs Uint8Array state vectors.
 * 
 * ARCHITECT CONSTRAINTS:
 * 1. Passwords are never transmitted; only used locally to derive a 256-bit AES-GCM key.
 * 2. PBKDF2 must use a strict, hardcoded static salt for universal deterministic cross-device derivation.
 * 3. AES-GCM must generate a new 12-byte dynamic IV per encryption using window.crypto.getRandomValues().
 * 4. The IV must be prefixed (concatenated) to the front of the resulting encrypted payload.
 */

// 1. Static Hardcoded Salt (Crucial for cross-device derivation of the same Room Password)
const GLOBAL_STATIC_SALT = new TextEncoder().encode("cubit-connect-pbkdf2-salt-v1");
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives a 256-bit AES-GCM CryptoKey from a plaintext passphrase.
 */
export async function deriveSyncKey(passphrase: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: GLOBAL_STATIC_SALT,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false, // The key cannot be extracted/exported from browser memory
        ["encrypt", "decrypt"]
    );
}

/**
 * Derives a salted Room ID hash from the passphrase (Protects against Rainbow Table attacks)
 */
export async function deriveRoomId(passphrase: string): Promise<string> {
    const enc = new TextEncoder();
    // MoE Mandate: Prepend a static salt to the passphrase before hashing
    const data = enc.encode(`cubit-routing-salt-${passphrase}`);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);

    // Convert ArrayBuffer to Hex String
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypts a raw Uint8Array (Yjs update) and prefixes a dynamic 12-byte IV for network transport.
 */
export async function encryptUpdate(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    // Generate a brand new IV for every single encryption mathematically
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const cipherBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        data as BufferSource
    );

    const cipherArray = new Uint8Array(cipherBuffer);

    // Prefix IV to ciphertext: [12 bytes IV] + [N bytes Ciphertext]
    const payload = new Uint8Array(iv.length + cipherArray.length);
    payload.set(iv, 0);
    payload.set(cipherArray, iv.length);

    return payload;
}

/**
 * Extracts the 12-byte IV prefix and decrypts the remaining payload back into a raw Uint8Array.
 */
export async function decryptUpdate(payload: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    if (payload.length < 12) {
        throw new Error("E2EE Decryption Failure: Payload is too short to contain an Initialization Vector.");
    }

    // Extract the exact 12-byte IV that was prefixed during encryption
    const iv = payload.slice(0, 12);
    const cipherData = payload.slice(12);

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            cipherData
        );

        return new Uint8Array(decryptedBuffer);
    } catch {
        // INTENTIONALLY PROPAGATING: Decryption failure indicates wrong key or corruption
        // Re-throw with user-friendly message for UI error handling
        throw new Error("E2EE Decryption Failure: Invalid passphrase or corrupted network payload.");
    }
}
