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
  handler: string | null;
  action_taken: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_approved: boolean | null;
  category_label: string | null;
  category_color: string | null;
  /** Outlook importance flag + urgency keyword detection ('low' | 'normal' | 'high') */
  email_importance: 'low' | 'normal' | 'high' | null;
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
  handler: string | null;
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
  auto_file: 'Auto-routed',
  review: 'To Review',
  low: 'Low Confidence',
  no_match: 'Unmatched',
};

export const CONFIDENCE_BAND_COLORS: Record<ConfidenceBand, string> = {
  auto_file: 'bg-emerald-100 text-emerald-700',
  review: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-700',
  no_match: 'bg-gray-100 text-gray-500',
};

export const MATCH_SOURCE_LABELS: Record<string, string> = {
  conversation_thread: 'Email Thread',
  reference_exact:     'Booking Ref.',
  rg_match:            'Opera Cloud',
  sender_history:      'Known Guest',
  ai_classifier_scoped:'AI · By Dept',
  ai_classifier_global:'AI · Global',
  kb_party_exact:      'Guest Profile',
  kb_party_common:     'Name Match',
  kb_party_fuzzy:      'Fuzzy Match',
  kb_keyword:          'Keywords',
  kleos_search:        'PMS Search',
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
  handler?: string;
  date_from?: string;
  date_to?: string;
  reviewed?: string;
  category?: string;
  page?: number;
  per_page?: number;
}

export type CategoryColor = 'green' | 'orange' | 'red' | 'blue' | 'grey' | 'purple';

export const CATEGORY_LABELS: Record<string, string> = {
  green: 'Routed',
  orange: 'To Review',
  red: 'Unmatched',
  blue: 'OTA Booking',
  grey: 'Ignored',
  purple: 'New Guest',
};

export const CATEGORY_STYLES: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  orange: 'bg-amber-100 text-amber-700 border-amber-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  grey: 'bg-gray-100 text-gray-500 border-gray-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
};

// ── Action / Urgency Status ──────────────────────────────────────────────────

export type ActionStatus = 'urgent' | 'to_review' | 'unclassified' | 'done';

/** Derive what action the handler needs to take on this match */
export function getActionStatus(log: MatchLog): ActionStatus {
  // Already handled
  if (log.review_approved === true) return 'done';
  if (log.action_taken === 'auto_filed') return 'done';
  // Matched but awaiting review
  if (log.matched && log.review_approved === null) {
    // Sender explicitly flagged high importance OR urgency keywords detected in subject
    if (log.email_importance === 'high') return 'urgent';
    // Time-based escalation: pending review for more than 48h
    const ageMs = log.received_at
      ? Date.now() - new Date(log.received_at).getTime()
      : 0;
    return ageMs / (1000 * 60 * 60 * 24) >= 2 ? 'urgent' : 'to_review';
  }
  // Not matched — needs manual classification
  if (!log.matched) {
    // High importance unmatched = extra urgent
    if (log.email_importance === 'high') return 'urgent';
    return 'unclassified';
  }
  return 'done';
}

export const ACTION_STATUS_CONFIG: Record<
  ActionStatus,
  { label: string; accentBg: string; badgeClass: string; dotClass: string; pulse: boolean }
> = {
  urgent: {
    label: 'Urgent',
    accentBg: 'bg-red-400',
    badgeClass: 'bg-red-50 text-red-600 border-red-200',
    dotClass: 'bg-red-400',
    pulse: true,
  },
  to_review: {
    label: 'To Review',
    accentBg: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-600 border-amber-200',
    dotClass: 'bg-amber-400',
    pulse: false,
  },
  unclassified: {
    label: 'Unrouted',
    accentBg: 'bg-slate-300',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
    dotClass: 'bg-gray-300',
    pulse: false,
  },
  done: {
    label: '',
    accentBg: '',
    badgeClass: '',
    dotClass: 'bg-emerald-400',
    pulse: false,
  },
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
