/**
 * Email Fetcher
 * Fetches email content and attachments from Microsoft Graph
 */

import {
  GraphClient,
  StorageClient,
  generateAttachmentHash,
  extractPdfText,
  isPdf,
  type ProcessingRecord,
  type AttachmentInfo,
  type GraphMessage,
} from '@lb-bot/shared';

export interface FetchResult {
  success: boolean;
  message?: GraphMessage;
  attachments: AttachmentInfo[];
  error?: string;
}

export class EmailFetcher {
  constructor(
    private graphClient: GraphClient,
    private storageClient: StorageClient
  ) {}

  /**
   * Fetch email and attachments
   */
  async fetch(record: ProcessingRecord): Promise<FetchResult> {
    try {
      // Update status
      record.status = 'FETCHING';
      record.timestamps.lastUpdated = new Date().toISOString();
      await this.storageClient.upsertProcessingRecord(record);

      // Fetch message with attachments
      const message = await this.graphClient.getMessageWithAttachments(
        record.mailbox,
        record.messageId
      );

      // Update record with message info
      record.internetMessageId = message.internetMessageId;
      record.conversationId = message.conversationId;

      // Process attachments
      const attachments: AttachmentInfo[] = [];

      if (message.attachments && message.attachments.length > 0) {
        for (const att of message.attachments) {
          // Skip inline images and item attachments
          if (att.isInline || att['@odata.type'] === '#microsoft.graph.itemAttachment') {
            continue;
          }

          const attachmentInfo: AttachmentInfo = {
            id: att.id,
            name: att.name,
            contentType: att.contentType,
            size: att.size,
            needsOcr: false,
            filed: false,
          };

          // Download and process file attachments
          if (att['@odata.type'] === '#microsoft.graph.fileAttachment') {
            try {
              const { buffer, contentType, name } = await this.graphClient.getAttachmentContent(
                record.mailbox,
                record.messageId,
                att.id
              );

              // Generate content hash for deduplication
              attachmentInfo.contentHash = generateAttachmentHash(buffer);

              // Store attachment in blob storage
              await this.storageClient.uploadAttachment(
                record.messageId,
                att.id,
                buffer,
                contentType
              );

              // Extract text from PDFs
              if (isPdf(contentType, name)) {
                const { text, needsOcr } = await extractPdfText(buffer);
                attachmentInfo.extractedText = text.slice(0, 10000); // Limit stored text
                attachmentInfo.needsOcr = needsOcr;
              }
            } catch (error) {
              console.error(`Error processing attachment ${att.id}:`, error);
              // Continue with other attachments
            }
          }

          attachments.push(attachmentInfo);
        }
      }

      // Update record
      record.attachments = attachments;
      record.status = 'FETCHED';
      record.timestamps.fetched = new Date().toISOString();
      record.timestamps.lastUpdated = new Date().toISOString();

      record.auditTrail.push({
        action: 'EMAIL_FETCHED',
        timestamp: new Date().toISOString(),
        success: true,
        details: {
          hasAttachments: attachments.length > 0,
          attachmentCount: attachments.length,
        },
      });

      await this.storageClient.upsertProcessingRecord(record);

      return {
        success: true,
        message,
        attachments,
      };
    } catch (error) {
      console.error('Error fetching email:', error);

      record.status = 'ERROR_RETRYABLE';
      record.retryCount++;
      record.timestamps.lastUpdated = new Date().toISOString();
      record.auditTrail.push({
        action: 'EMAIL_FETCH_FAILED',
        timestamp: new Date().toISOString(),
        success: false,
        error: String(error),
      });

      await this.storageClient.upsertProcessingRecord(record);

      return {
        success: false,
        attachments: [],
        error: String(error),
      };
    }
  }
}
