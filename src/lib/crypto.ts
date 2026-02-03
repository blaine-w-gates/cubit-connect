// Simple Client-Side Obfuscation
// Note: This is not military-grade encryption, but prevents casual shoulder-surfing
// and protects against basic local storage dumps.

const SALT = 'CUBIT_V1_SALT_'; // Static salt for reconstruction

export const cryptoUtils = {
  encrypt: (text: string): string => {
    if (!text) return '';
    try {
      // Simple Base64 encoding with salt
      return btoa(SALT + text);
    } catch (e) {
      console.error('Encryption failed', e);
      return text;
    }
  },

  decrypt: (cypherText: string): string => {
    if (!cypherText) return '';
    try {
      const decoded = atob(cypherText);
      if (decoded.startsWith(SALT)) {
        return decoded.slice(SALT.length);
      }
      // If salt is missing, it might be a legacy raw key. Return as is.
      return cypherText;
    } catch {
      // 🛡️ LEGACY FALLBACK:
      // If atob throws (invalid chars), it's likely a raw API key from Tier 1.
      // Return it as-is so the app doesn't crash.
      return cypherText;
    }
  },

  cleanInput: (text: string): string => {
    if (!text) return '';
    // Strip invisible control characters (Paste Bomb defense)
    // Removes zero-width spaces, null bytes, etc.
    return text.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u200B-\u200D\uFEFF]/g, '');
  },
};
