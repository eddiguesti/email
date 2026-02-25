/**
 * Upload Knowledge Base to Azure Blob Storage
 *
 * Usage:
 *   set -a && source config/.env && set +a
 *   tsx config/scripts/upload-knowledge-base.ts [path-to-json]
 *
 * Requires AZURE_STORAGE_CONNECTION_STRING in environment.
 * Uploads kleos-knowledge.json to the blob container so the Azure Functions
 * worker can download it at startup.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { BlobServiceClient } from '@azure/storage-blob';

const DEFAULT_PATH = resolve(import.meta.dirname || '.', '../../config/kleos-knowledge.json');
// Fallback if import.meta.dirname is unavailable
const filePath = process.argv[2]
  ? resolve(process.argv[2])
  : existsSync(DEFAULT_PATH)
    ? DEFAULT_PATH
    : resolve('config/kleos-knowledge.json');

const containerName = process.env.KNOWLEDGE_BASE_CONTAINER || 'config';
const blobName = process.env.KNOWLEDGE_BASE_BLOB || 'kleos-knowledge.json';

async function main() {
  console.log('=== Upload Knowledge Base to Azure Blob Storage ===\n');

  // Validate file
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.error('Usage: tsx upload-knowledge-base.ts [path-to-json]');
    process.exit(1);
  }

  const fileSize = statSync(filePath).size;
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const dossierCount = data.dossiers?.length || 0;

  console.log(`File:      ${filePath}`);
  console.log(`Size:      ${(fileSize / 1024).toFixed(0)} KB`);
  console.log(`Dossiers:  ${dossierCount}`);
  console.log(`Container: ${containerName}`);
  console.log(`Blob:      ${blobName}\n`);

  // Validate connection string
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    console.error('AZURE_STORAGE_CONNECTION_STRING is not set.');
    console.error('Set it in config/.env or export it before running this script.');
    process.exit(1);
  }

  // Upload
  const blobService = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobService.getContainerClient(containerName);

  // Create container if it doesn't exist
  await containerClient.createIfNotExists();
  console.log(`Container "${containerName}" ready.`);

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(content, Buffer.byteLength(content, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    metadata: {
      dossierCount: String(dossierCount),
      uploadedAt: new Date().toISOString(),
    },
  });

  console.log(`\nUploaded "${blobName}" to "${containerName}" container.`);

  // Verify
  const props = await blockBlobClient.getProperties();
  console.log(`Verified:  ${props.contentLength} bytes, last modified ${props.lastModified?.toISOString()}`);
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
