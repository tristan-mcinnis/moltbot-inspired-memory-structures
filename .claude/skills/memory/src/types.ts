/**
 * Core types for the memory system
 */

export interface MemoryConfig {
  /** Base storage path (default: ~/.memory-test) */
  storagePath: string;
  /** Maximum tokens before triggering compaction */
  contextWindow: number;
  /** Tokens to reserve for responses */
  reserveTokens: number;
  /** Soft threshold offset for pre-compaction flush */
  softThresholdTokens: number;
  /** Tokens to keep after compaction */
  keepRecentTokens: number;
  /** Timezone for timestamps (IANA format, e.g., America/New_York) */
  timezone: string;
  /** Date format for daily notes (default: YYYY-MM-DD) */
  dateFormat: string;
  /** Memory sections (customizable) */
  sections: string[];
}

export interface MemoryEntry {
  timestamp: Date;
  content: string;
  category?: string;
}

export interface DailyNoteEntry {
  time: string;
  content: string;
  section?: string;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  matchedText: string;
}

export interface TranscriptEntry {
  id: string;
  parentId: string | null;
  timestamp: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'compaction';
  role?: 'user' | 'assistant';
  content: string;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

export interface SessionMetadata {
  sessionId: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  totalTokens: number;
  entryCount: number;
  compactionCount: number;
}

export interface CompactionResult {
  summary: string;
  removedEntryCount: number;
  tokensSaved: number;
  newTotalTokens: number;
}

export const DEFAULT_CONFIG: MemoryConfig = {
  storagePath: `${process.env.HOME}/.memory-test`,
  contextWindow: 100000,
  reserveTokens: 4000,
  softThresholdTokens: 10000,
  keepRecentTokens: 20000,
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  sections: ['Preferences', 'People', 'Projects', 'Facts'],
};
