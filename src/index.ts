/**
 * Memory System for Agents
 *
 * A three-tier memory architecture inspired by Moltbot:
 * 1. Session Transcripts (ephemeral) - JSONL conversation logs
 * 2. Daily Notes (episodic) - Day-to-day context
 * 3. Long-Term Memory (curated) - Persistent facts and preferences
 */

// Core exports
export { MemoryManager, type MemoryManagerConfig } from './memory/MemoryManager.js';
export { LongTermMemory, type LongTermMemoryConfig } from './memory/LongTermMemory.js';
export { DailyNotes, type DailyNotesConfig } from './memory/DailyNotes.js';

// Session exports
export { SessionStore, type SessionStoreConfig } from './sessions/SessionStore.js';
export { Transcript, type TranscriptConfig } from './sessions/Transcript.js';

// Type exports
export {
  MemoryConfig,
  MemoryEntry,
  DailyNoteEntry,
  SearchResult,
  TranscriptEntry,
  SessionMetadata,
  CompactionResult,
  DEFAULT_CONFIG,
} from './memory/types.js';

// Utility exports
export {
  countTokens,
  countTokensMultiple,
  truncateToTokens,
  estimateTokens,
  freeEncoder,
} from './utils/tokens.js';

export {
  parseSections,
  extractBulletPoints,
  formatTime,
  formatDate,
  createSection,
  createTimestampedEntry,
  appendToSection,
} from './utils/markdown.js';
