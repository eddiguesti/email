/**
 * Knowledge Base Loader (Singleton)
 * Loads the KLEOS knowledge base with a 3-tier fallback chain:
 *   1. Local file via KNOWLEDGE_BASE_PATH env var (for local dev with `func start`)
 *   2. File adjacent to compiled code (for bundled deployments)
 *   3. Azure Blob Storage download (for cloud deployment)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BlobServiceClient } from '@azure/storage-blob';
import {
  loadKnowledgeBase,
  loadKnowledgeBaseFromBuffer,
  type KnowledgeBase,
} from '@lb-bot/shared/matching';

let cachedKb: KnowledgeBase | null = null;

/**
 * Load the knowledge base (singleton — cached after first load).
 * Throws if no knowledge base can be found.
 */
export async function getKnowledgeBase(): Promise<KnowledgeBase> {
  if (cachedKb) return cachedKb;

  // Strategy 1: Local file path from env var
  const localPath = process.env.KNOWLEDGE_BASE_PATH;
  if (localPath && existsSync(localPath)) {
    console.log(`Loading knowledge base from local file: ${localPath}`);
    cachedKb = loadKnowledgeBase(localPath);
    console.log(`  ${cachedKb.totalDossiers} dossiers loaded`);
    return cachedKb;
  }

  // Strategy 2: Adjacent to compiled code (CJS-compatible)
  const candidates = [
    join(__dirname, 'kleos-knowledge.json'),
    join(process.cwd(), 'dist', 'kleos-knowledge.json'),
    join(process.cwd(), 'kleos-knowledge.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        console.log(`Loading knowledge base from: ${candidate}`);
        cachedKb = loadKnowledgeBase(candidate);
        console.log(`  ${cachedKb.totalDossiers} dossiers loaded`);
        return cachedKb;
      }
    } catch {
      // Try next candidate
    }
  }

  // Strategy 3: Azure Blob Storage
  const blobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const blobContainer = process.env.KNOWLEDGE_BASE_CONTAINER || 'config';
  const blobName = process.env.KNOWLEDGE_BASE_BLOB || 'kleos-knowledge.json';

  if (blobConnectionString) {
    console.log(`Downloading knowledge base from Azure Blob: ${blobContainer}/${blobName}`);
    try {
      const blobService = BlobServiceClient.fromConnectionString(blobConnectionString);
      const containerClient = blobService.getContainerClient(blobContainer);
      const blobClient = containerClient.getBlobClient(blobName);
      const downloadResponse = await blobClient.download();
      const chunks: Buffer[] = [];
      if (downloadResponse.readableStreamBody) {
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }
      const buffer = Buffer.concat(chunks);
      cachedKb = loadKnowledgeBaseFromBuffer(buffer);
      console.log(`  ${cachedKb.totalDossiers} dossiers loaded from Blob Storage`);
      return cachedKb;
    } catch (err) {
      console.error(`  Failed to load KB from Blob Storage: ${(err as Error).message}`);
    }
  }

  throw new Error(
    'Knowledge base not found. Set KNOWLEDGE_BASE_PATH env var, ' +
    'place kleos-knowledge.json adjacent to compiled code, ' +
    'or configure AZURE_STORAGE_CONNECTION_STRING for Blob Storage download.'
  );
}
