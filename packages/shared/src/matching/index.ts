/**
 * Matching Engine — barrel exports.
 * Usage: import { MatchingEngine, shouldSkipEmail, ... } from '@lb-bot/shared/matching'
 */

export * from './types.js';
export * from './constants.js';
export * from './skip-filter.js';
export * from './extractors.js';
export * from './name-matching.js';
export * from './ai-classifier.js';
export * from './knowledge-base.js';
export * from './supabase-persistence.js';
export * from './category-classifier.js';
export { MatchingEngine } from './engine.js';
export { detectMeetingIntent } from './meeting-detector.js';
