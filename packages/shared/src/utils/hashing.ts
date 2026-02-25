/**
 * Hashing Utilities
 * Content hashing for idempotency and deduplication
 */

import CryptoJS from 'crypto-js';

/**
 * Generate SHA-256 hash of content
 */
export function sha256(content: string | Buffer): string {
  const data = typeof content === 'string' ? content : content.toString('base64');
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
}

/**
 * Generate MD5 hash (faster, for non-security uses like deduplication)
 */
export function md5(content: string | Buffer): string {
  const data = typeof content === 'string' ? content : content.toString('base64');
  return CryptoJS.MD5(data).toString(CryptoJS.enc.Hex);
}

/**
 * Generate content hash for email (for idempotency)
 * Includes key identifying fields
 */
export function generateEmailHash(params: {
  internetMessageId: string;
  subject: string;
  senderEmail: string;
  receivedDateTime: string;
}): string {
  const content = [
    params.internetMessageId,
    params.subject,
    params.senderEmail.toLowerCase(),
    params.receivedDateTime,
  ].join('|');

  return sha256(content);
}

/**
 * Generate content hash for attachment (for deduplication)
 */
export function generateAttachmentHash(content: Buffer): string {
  return sha256(content);
}

/**
 * Generate idempotency key for a job
 */
export function generateIdempotencyKey(params: {
  tenantId: string;
  mailbox: string;
  messageId: string;
  action?: string;
}): string {
  const parts = [
    params.tenantId,
    params.mailbox,
    params.messageId,
    params.action || 'process',
  ];

  return sha256(parts.join('|')).slice(0, 32);
}

/**
 * Generate unique ID
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  const id = `${timestamp}${random}`;
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate draft ID
 */
export function generateDraftId(messageId: string, draftType: string): string {
  return `${messageId}_${draftType}_${Date.now().toString(36)}`;
}

/**
 * Verify content hash matches
 */
export function verifyHash(content: string | Buffer, expectedHash: string): boolean {
  const actualHash = sha256(content);
  return actualHash === expectedHash;
}

/**
 * Generate a short hash for display (first 8 chars)
 */
export function shortHash(content: string | Buffer): string {
  return sha256(content).slice(0, 8);
}
