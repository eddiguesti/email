/**
 * Signal Extractor
 * Extracts RG numbers, entities, and other signals from email content
 */

import {
  StorageClient,
  extractSignals,
  sha256,
  stripHtml,
  type ProcessingRecord,
  type GraphMessage,
  type ExtractedSignals,
} from '@lb-bot/shared';

export interface ExtractResult {
  success: boolean;
  signals?: ExtractedSignals;
  error?: string;
}

export class SignalExtractor {
  constructor(private storageClient: StorageClient) {}

  /**
   * Extract signals from email
   */
  async extract(record: ProcessingRecord, message: GraphMessage): Promise<ExtractResult> {
    try {
      // Update status
      record.status = 'EXTRACTING';
      record.timestamps.lastUpdated = new Date().toISOString();
      await this.storageClient.upsertProcessingRecord(record);

      // Get email body
      const bodyContent = message.body?.content ?? '';
      const bodyContentType = message.body?.contentType ?? 'text';

      // Convert HTML to plain text if needed
      const plainBody = bodyContentType === 'html' ? stripHtml(bodyContent) : bodyContent;

      // Generate body hash
      const bodyHash = sha256(plainBody);

      // Get sender email
      const senderEmail = message.from?.emailAddress?.address || message.sender?.emailAddress?.address || '';

      // Get recipient emails
      const recipientEmails = [
        ...(message.toRecipients || []),
        ...(message.ccRecipients || []),
      ].map(r => r.emailAddress.address);

      // Extract signals
      const signals = extractSignals(
        message.subject,
        bodyContent,
        bodyContentType,
        senderEmail,
        recipientEmails,
        bodyHash,
        record.attachments.length
      );

      // Enrich signals with attachment content
      for (const attachment of record.attachments) {
        if (attachment.extractedText) {
          // Extract additional RG numbers from attachments
          const attachmentSignals = extractSignals(
            attachment.name,
            attachment.extractedText,
            'text',
            senderEmail,
            [],
            '',
            0
          );

          // Merge RG numbers
          for (const rg of attachmentSignals.rgNumbers) {
            if (!signals.rgNumbers.includes(rg)) {
              signals.rgNumbers.push(rg);
            }
          }

          // Merge entities
          for (const entity of attachmentSignals.entities) {
            const exists = signals.entities.some(
              e => e.type === entity.type && e.value === entity.value
            );
            if (!exists) {
              signals.entities.push(entity);
            }
          }
        }
      }

      // Update record
      record.extractedSignals = signals;
      record.status = 'EXTRACTED';
      record.timestamps.extracted = new Date().toISOString();
      record.timestamps.lastUpdated = new Date().toISOString();

      record.auditTrail.push({
        action: 'SIGNALS_EXTRACTED',
        timestamp: new Date().toISOString(),
        success: true,
        details: {
          rgNumbersFound: signals.rgNumbers.length,
          entitiesFound: signals.entities.length,
          isReply: signals.isReply,
          isForward: signals.isForward,
        },
      });

      await this.storageClient.upsertProcessingRecord(record);

      return {
        success: true,
        signals,
      };
    } catch (error) {
      console.error('Error extracting signals:', error);

      record.status = 'ERROR_RETRYABLE';
      record.retryCount++;
      record.timestamps.lastUpdated = new Date().toISOString();
      record.auditTrail.push({
        action: 'SIGNAL_EXTRACTION_FAILED',
        timestamp: new Date().toISOString(),
        success: false,
        error: String(error),
      });

      await this.storageClient.upsertProcessingRecord(record);

      return {
        success: false,
        error: String(error),
      };
    }
  }
}
