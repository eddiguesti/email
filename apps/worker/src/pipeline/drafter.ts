/**
 * Draft Generator
 * Generates email drafts from templates based on email context
 */

import {
  StorageClient,
  generateReplyTemplate,
  generateClientTransmittal,
  generateLeaveAcknowledgement,
  generateDraftId,
  type ProcessingRecord,
  type DraftInfo,
} from '@lb-bot/shared';

export interface DraftGenerationResult {
  success: boolean;
  drafts: DraftInfo[];
  error?: string;
}

interface FirmConfig {
  firmName: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
}

// Patterns to detect leave-related emails
const LEAVE_PATTERNS = [
  /\b(?:congé|vakantie|verlof|leave|absence|out\s+of\s+office|ooo)\b/i,
  /\b(?:maladie|ziekte|sick|medical)\b/i,
  /\b(?:parental|maternité|paternité|ouderschaps)\b/i,
];

// Patterns to detect if email needs client transmittal
const TRANSMITTAL_PATTERNS = [
  /\b(?:veuillez\s+trouver|please\s+find|attached|bijgevoegd|ci-joint)\b/i,
  /\b(?:expert|rapport|report|conclusion|expertise)\b/i,
];

export class DraftGenerator {
  constructor(
    private storageClient: StorageClient,
    private firmConfig: FirmConfig,
    private lawyerName: string = 'Lawyer'
  ) {}

  /**
   * Auto-generate appropriate drafts based on email content
   */
  async generateAutoDrafts(record: ProcessingRecord): Promise<DraftGenerationResult> {
    try {
      const drafts: DraftInfo[] = [];
      const now = new Date().toISOString();
      const signals = record.extractedSignals;

      if (!signals) {
        return { success: false, drafts: [], error: 'No signals available' };
      }

      const combinedText = `${signals.subject} ${signals.bodyPreview}`.toLowerCase();

      // Always generate a reply draft
      const replyDraft = this.generateReplyDraft(record);
      if (replyDraft) {
        drafts.push(replyDraft);
      }

      // Check for leave-related email
      const isLeaveRelated = LEAVE_PATTERNS.some(p => p.test(combinedText));
      if (isLeaveRelated) {
        const leaveDraft = this.generateLeaveAckDraft(record);
        if (leaveDraft) {
          drafts.push(leaveDraft);
        }
      }

      // Check for emails that might need client transmittal
      const needsTransmittal =
        record.attachments.length > 0 &&
        TRANSMITTAL_PATTERNS.some(p => p.test(combinedText));

      if (needsTransmittal) {
        const transmittalDraft = this.generateTransmittalDraft(record);
        if (transmittalDraft) {
          drafts.push(transmittalDraft);
        }
      }

      // Save drafts to storage
      for (const draft of drafts) {
        await this.storageClient.saveDraft(record.messageId, draft, record.mailbox);
      }

      // Update record
      record.actions.draftsCreated = drafts.map(d => d.id);
      record.timestamps.lastUpdated = now;
      record.auditTrail.push({
        action: 'DRAFTS_AUTO_GENERATED',
        timestamp: now,
        success: true,
        details: {
          draftTypes: drafts.map(d => d.type),
          count: drafts.length,
        },
      });

      await this.storageClient.upsertProcessingRecord(record);

      return { success: true, drafts };
    } catch (error) {
      console.error('Error generating drafts:', error);
      return {
        success: false,
        drafts: [],
        error: String(error),
      };
    }
  }

  /**
   * Generate a reply draft
   */
  private generateReplyDraft(record: ProcessingRecord): DraftInfo | null {
    const signals = record.extractedSignals;
    if (!signals) return null;

    const template = generateReplyTemplate({
      originalSender: signals.senderEmail,
      originalSubject: signals.subject,
      dossierRef: record.chosenDossierId,
      dossierName: record.chosenDossierName,
      lawyerName: this.lawyerName,
      firmName: this.firmConfig.firmName,
      firmAddress: this.firmConfig.firmAddress,
      firmPhone: this.firmConfig.firmPhone,
      firmEmail: this.firmConfig.firmEmail,
    });

    return {
      id: generateDraftId(record.messageId, 'reply'),
      type: 'reply',
      subject: template.subject,
      body: template.bodyHtml,
      to: [signals.senderEmail],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a leave acknowledgement draft
   */
  private generateLeaveAckDraft(record: ProcessingRecord): DraftInfo | null {
    const signals = record.extractedSignals;
    if (!signals) return null;

    // Detect leave type from content
    const combinedText = `${signals.subject} ${signals.bodyPreview}`.toLowerCase();
    let leaveType: 'vacation' | 'sick' | 'parental' | 'other' = 'other';

    if (/\b(?:maladie|ziekte|sick|medical)\b/i.test(combinedText)) {
      leaveType = 'sick';
    } else if (/\b(?:parental|maternité|paternité|ouderschaps)\b/i.test(combinedText)) {
      leaveType = 'parental';
    } else if (/\b(?:congé|vakantie|verlof|vacation|holiday)\b/i.test(combinedText)) {
      leaveType = 'vacation';
    }

    const template = generateLeaveAcknowledgement({
      senderName: signals.senderEmail.split('@')[0],
      senderEmail: signals.senderEmail,
      leaveType,
      originalSubject: signals.subject,
      acknowledgerName: this.lawyerName,
      firmName: this.firmConfig.firmName,
    });

    return {
      id: generateDraftId(record.messageId, 'leave_acknowledgement'),
      type: 'leave_acknowledgement',
      subject: template.subject,
      body: template.bodyHtml,
      to: template.to,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a client transmittal draft
   */
  private generateTransmittalDraft(record: ProcessingRecord): DraftInfo | null {
    const signals = record.extractedSignals;
    if (!signals) return null;

    // Use sender as the client (the person who sent the document)
    const clientEmail = signals.senderEmail;
    const clientName = signals.senderEmail.split('@')[0];

    const template = generateClientTransmittal({
      clientName,
      clientEmail,
      dossierRef: record.chosenDossierId || 'Unknown',
      dossierName: record.chosenDossierName || 'Unknown',
      documentDescription: signals.subject,
      attachmentNames: record.attachments.map(a => a.name),
      lawyerName: this.lawyerName,
      firmName: this.firmConfig.firmName,
      firmPhone: this.firmConfig.firmPhone,
      firmEmail: this.firmConfig.firmEmail,
    });

    return {
      id: generateDraftId(record.messageId, 'client_transmittal'),
      type: 'client_transmittal',
      subject: template.subject,
      body: template.bodyHtml,
      to: template.to,
      createdAt: new Date().toISOString(),
    };
  }
}
