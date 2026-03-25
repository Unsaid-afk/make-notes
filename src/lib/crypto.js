/**
 * E2EE Crypto Module — AES-GCM 256-bit
 * Key derivation from shared secret using PBKDF2
 * Everything runs client-side only — key NEVER leaves the browser
 */

const SALT = 'golgappa-e2ee-salt-v1'; // Static salt (room-scoped security comes from the secret)
const ITERATIONS = 100000;

/**
 * Derive a CryptoKey from a shared secret passphrase
 */
export async function deriveKey(secret) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext message
 * Returns { encrypted: base64, iv: base64 }
 */
export async function encryptMessage(plaintext, cryptoKey) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(plaintext)
  );

  return {
    encrypted: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt a message from encrypted + iv (both base64)
 * Returns plaintext string
 */
export async function decryptMessage(encryptedB64, ivB64, cryptoKey) {
  try {
    const ciphertext = base64ToArrayBuffer(encryptedB64);
    const iv = base64ToArrayBuffer(ivB64);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch (err) {
    return '[Decryption failed — wrong key?]';
  }
}

// ── Utility functions ──

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
