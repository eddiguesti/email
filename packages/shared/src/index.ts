// Types
export * from './types/index.js';

// Drafting
export * from './drafting/index.js';

// Clients
export * from './clients/index.js';

// Utilities
export * from './utils/index.js';

// Templates
export * from './templates/index.js';

// Matching Engine (explicit exports to avoid name collisions with utils)
export {
  // Types
  type DossierKnowledge,
  type KnowledgeBase,
  type PipelineMatchResult,
  type MailboxOwner,
  type MatchSignals,
  type EBarreauData,
  type AIClassifierConfig,
  type AIClassification,
  type AIExtraction,
  type MatchingEngineConfig,
  type KleosSearchFn,
  type GraphEmailData,
  type PipelineRunStats,
  type SenderHistoryEntry,
  // Constants
  SKIP_SENDERS,
  SKIP_DOMAINS,
  NAME_BLOCKLIST,
  COMMON_WORDS,
  KEYWORD_NOISE,
  FIRM_ADMIN_DOSSIER_REF,
  // Skip filter
  shouldSkipEmail,
  parseEBarreau,
  hasSignificantEBarreauParties,
  getMeaningfulEBarreauParties,
  // Name matching
  normalize,
  isBlockedName,
  fuzzyNameMatch,
  // AI classifier
  classifyWithAI,
  // Knowledge base
  loadKnowledgeBase,
  loadKnowledgeBaseFromBuffer,
  buildDossierIndex,
  resolveMailboxOwner,
  resolveRecipientDossiers,
  getLawyer,
  // Supabase persistence
  hashSubject,
  saveMatchLog,
  persistSenderHistory,
  persistConversationThread,
  savePipelineRun,
  loadSenderHistoryFromDB,
  loadConversationThreadsFromDB,
  // Engine
  MatchingEngine,
  // Meeting detector
  detectMeetingIntent,
} from './matching/index.js';
