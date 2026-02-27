/**
 * Types for AI Draft Reply feature.
 */

export interface StyleProfile {
  email: string;
  displayName: string;
  styleSummary: string;
  sampleGreetings: string[];
  sampleSignoffs: string[];
  formalityLevel: 'formal' | 'semi-formal';
  avgReplyLength: number;
  rawSamples: string[];
  expiresAt: string;
}

export interface DraftReplyInput {
  senderName: string;
  senderEmail: string;
  subject?: string;       // Original email subject
  emailBody?: string;     // Plain-text body of the email being replied to
  dossierRef: string | null;
  dossierName: string | null;
  matchReasons: string[];
  matchSource: string | null;
  isEBarreau: boolean;
  lawyerEmail: string;
}

export interface DraftReplyResult {
  draft: string;
  confidence: 'high' | 'medium' | 'low';
  styleMatch: string;
}

export interface AIConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}
