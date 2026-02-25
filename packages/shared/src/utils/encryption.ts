/**
 * Token Encryption Utilities
 *
 * Encrypts sensitive data (OAuth tokens) before storage.
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Minimum size for encrypted data: salt + iv + authTag + at least 1 byte of ciphertext
const MIN_ENCRYPTED_SIZE = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;

/**
 * Get encryption key from environment variable
 * Derives a 256-bit key using scrypt
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
  }

  // Derive a 256-bit key using scrypt
  return scryptSync(secret, salt, 32);
}

/**
 * Check if TOKEN_ENCRYPTION_KEY is configured
 */
export function isEncryptionEnabled(): boolean {
  return !!process.env.TOKEN_ENCRYPTION_KEY;
}

/**
 * Encrypt a string value
 * Returns a base64 encoded string containing: salt + iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const salt = randomBytes(SALT_LENGTH);
  const key = getEncryptionKey(salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a string value
 * Expects a base64 encoded string containing: salt + iv + authTag + ciphertext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';

  try {
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    const key = getEncryptionKey(salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Check if a value appears to be encrypted by this module.
 * Our encrypted format is: base64(salt[32] + iv[16] + authTag[16] + ciphertext).
 * JWTs (Microsoft access tokens, etc.) start with 'eyJ' and must not be treated as encrypted.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < MIN_ENCRYPTED_SIZE) {
    return false;
  }

  // JWTs always start with 'eyJ' (base64url of '{"') — never our encrypted format
  if (value.startsWith('eyJ')) {
    return false;
  }

  // Check if it's valid base64 and has the expected minimum size
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length >= MIN_ENCRYPTED_SIZE;
  } catch {
    return false;
  }
}

/**
 * Encrypt token if encryption is enabled and token is not already encrypted
 */
export function encryptToken(token: string | null): string | null {
  if (!token) return null;

  // Skip if encryption not enabled
  if (!isEncryptionEnabled()) {
    return token;
  }

  // Skip if already encrypted
  if (isEncrypted(token)) {
    return token;
  }

  return encrypt(token);
}

/**
 * Decrypt token, handling both encrypted and plaintext values
 * This allows for gradual migration of existing plaintext tokens
 */
export function decryptToken(token: string | null): string | null {
  if (!token) return null;

  // If encryption not enabled, return as-is
  if (!isEncryptionEnabled()) {
    return token;
  }

  // If not encrypted (legacy plaintext), return as-is
  if (!isEncrypted(token)) {
    return token;
  }

  return decrypt(token);
}
