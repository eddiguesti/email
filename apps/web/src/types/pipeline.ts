export interface MatchLog {
  id: string;
  created_at: string;
  mailbox: string;
  email_id: string;
  conversation_id: string | null;
  sender_email: string;
  sender_name: string | null;
  sender_domain: string | null;
  subject_hash: string;
  received_at: string | null;
  has_attachments: boolean;
  is_ebarreau: boolean;
  matched: boolean;
  dossier_id: number | null;
  dossier_ref: string | null;
  dossier_name: string | null;
  confidence: number | null;
  match_source: string | null;
  match_reasons: string[] | null;
  lawyer: string | null;
  action_taken: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_approved: boolean | null;
  category_label: string | null;
  category_color: string | null;
}

export interface PipelineRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  mailbox: string;
  emails_fetched: number;
  emails_skipped: number;
  emails_processed: number;
  emails_matched: number;
  emails_auto_filed: number;
  emails_review: number;
  emails_no_match: number;
  source_stats: Record<string, number>;
  error_count: number;
  errors: string[];
  status: string;
}

export interface SenderHistoryEntry {
  id: string;
  created_at: string;
  updated_at: string;
  sender_email: string;
  dossier_id: number;
  dossier_ref: string;
  dossier_name: string;
  match_count: number;
  last_seen: string;
  avg_confidence: number;
}

export interface ConversationThread {
  id: string;
  conversation_id: string;
  dossier_id: number;
  dossier_ref: string;
  dossier_name: string;
  confidence: number;
  match_source: string | null;
  lawyer: string | null;
  email_count: number;
  last_email_at: string;
}

export type ConfidenceBand = 'auto_file' | 'review' | 'low' | 'no_match';

export function getConfidenceBand(confidence: number | null, matched: boolean): ConfidenceBand {
  if (!matched || confidence === null) return 'no_match';
  if (confidence >= 0.85) return 'auto_file';
  if (confidence >= 0.60) return 'review';
  return 'low';
}

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  auto_file: 'Auto-classement',
  review: 'À revoir',
  low: 'Faible',
  no_match: 'Non classé',
};

export const CONFIDENCE_BAND_COLORS: Record<ConfidenceBand, string> = {
  auto_file: 'bg-emerald-100 text-emerald-700',
  review: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-700',
  no_match: 'bg-gray-100 text-gray-500',
};

export const MATCH_SOURCE_LABELS: Record<string, string> = {
  conversation_thread: 'Fil de conversation',
  reference_exact: 'Référence exacte',
  rg_match: 'Numéro RG',
  sender_history: 'Historique expéditeur',
  ai_classifier_scoped: 'IA (avocat)',
  ai_classifier_global: 'IA (global)',
  kb_party_exact: 'Partie connue (exact)',
  kb_party_common: 'Partie connue (commune)',
  kb_party_fuzzy: 'Partie connue (approx)',
  kb_keyword: 'Mots-clés dossier',
  kleos_search: 'Recherche KLEOS',
};

export const MATCH_SOURCE_COLORS: Record<string, string> = {
  conversation_thread: 'bg-blue-100 text-blue-700',
  reference_exact: 'bg-emerald-100 text-emerald-700',
  rg_match: 'bg-emerald-100 text-emerald-700',
  sender_history: 'bg-cyan-100 text-cyan-700',
  ai_classifier_scoped: 'bg-purple-100 text-purple-700',
  ai_classifier_global: 'bg-purple-100 text-purple-700',
  kb_party_exact: 'bg-orange-100 text-orange-700',
  kb_party_common: 'bg-orange-100 text-orange-700',
  kb_party_fuzzy: 'bg-orange-100 text-orange-700',
  kb_keyword: 'bg-yellow-100 text-yellow-700',
  kleos_search: 'bg-gray-100 text-gray-600',
};


export interface PipelineStats {
  overview: {
    total_processed: number;
    total_matched: number;
    match_rate: number;
    avg_confidence: number;
    total_auto_file: number;
    total_review: number;
    total_no_match: number;
  };
  confidence_distribution: Array<{ band: string; count: number }>;
  source_breakdown: Array<{ source: string; count: number; avg_confidence: number }>;
  daily_stats: Array<{ date: string; processed: number; matched: number; auto_filed: number }>;
  mailbox_stats: Array<{ mailbox: string; processed: number; matched: number; match_rate: number }>;
}

export interface AccuracyStats {
  review_coverage: {
    total: number;
    reviewed: number;
    unreviewed: number;
    coverage_rate: number;
  };
  accuracy_by_source: Array<{
    source: string;
    total: number;
    approved: number;
    rejected: number;
    accuracy: number;
    avg_confidence: number;
  }>;
  accuracy_by_confidence_band: Array<{
    band: string;
    total: number;
    approved: number;
    accuracy: number;
  }>;
  threshold_recommendations: Array<{
    threshold: string;
    current: number;
    suggested: number;
    reasoning: string;
  }>;
  false_positives: Array<{
    match_source: string | null;
    confidence: number | null;
    dossier_ref: string | null;
    mailbox: string;
    created_at: string;
  }>;
  daily_accuracy: Array<{
    date: string;
    total: number;
    approved: number;
    rejected: number;
    accuracy: number;
  }>;
}

export interface MatchLogFilters {
  mailbox?: string;
  matched?: boolean;
  confidence_min?: number;
  confidence_max?: number;
  source?: string;
  lawyer?: string;
  date_from?: string;
  date_to?: string;
  reviewed?: string;
  category?: string;
  page?: number;
  per_page?: number;
}

export type CategoryColor = 'green' | 'orange' | 'red' | 'blue' | 'grey' | 'purple';

export const CATEGORY_LABELS: Record<string, string> = {
  green: 'Classé',
  orange: 'À vérifier',
  red: 'Non classé',
  blue: 'eBarreau',
  grey: 'Ignoré',
  purple: 'Nouveau contact',
};

export const CATEGORY_STYLES: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  orange: 'bg-amber-100 text-amber-700 border-amber-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  grey: 'bg-gray-100 text-gray-500 border-gray-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
};

export interface DraftReplyResult {
  draft: string;
  confidence: 'high' | 'medium' | 'low';
  styleMatch: string;
}

export interface ActivityLog {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  details: Record<string, unknown> | null;
  resource_type: string | null;
  resource_id: string | null;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  email_notifications: boolean;
  urgent_alerts: boolean;
  language: string;
  // Onboarding
  onboarded?: boolean;
  onboarded_at?: string;
  // Bot configuration
  bot_mode?: 'observation' | 'assiste' | 'automatique';
  email_filter?: 'smart' | 'all' | 'clients';
}
