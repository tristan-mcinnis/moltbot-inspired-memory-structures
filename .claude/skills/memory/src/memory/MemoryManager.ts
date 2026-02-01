/**
 * Memory Manager - Main orchestrator for the memory system
 *
 * Coordinates long-term memory, daily notes, session transcripts,
 * compaction, and search functionality.
 */

import { join, basename } from 'node:path';
import { createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import archiver from 'archiver';
import OpenAI from 'openai';
import { LongTermMemory } from './LongTermMemory.js';
import { DailyNotes } from './DailyNotes.js';
import { SessionStore } from '../session/SessionStore.js';
import { Transcript } from '../session/Transcript.js';
import {
  MemoryConfig,
  DEFAULT_CONFIG,
  SearchResult,
  CompactionResult,
} from '../types.js';
import { countTokens } from '../utils/tokens.js';
import { formatDate } from '../utils/markdown.js';

export interface MemoryManagerConfig extends Partial<MemoryConfig> {
  agentId?: string;
  deepseekApiKey?: string;
}

export class MemoryManager {
  private config: MemoryConfig;
  private agentId: string;
  private longTermMemory: LongTermMemory;
  private dailyNotes: DailyNotes;
  private sessionStore: SessionStore;
  private currentSession: Transcript | null = null;
  private currentSessionId: string | null = null;
  private deepseek: OpenAI | null = null;
  private initialized: boolean = false;
  private deepseekApiKey: string | undefined;

  constructor(options: MemoryManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.agentId = options.agentId || 'default';
    this.deepseekApiKey = options.deepseekApiKey || process.env.DEEPSEEK_API_KEY;

    // Initialize components
    this.longTermMemory = new LongTermMemory({
      filePath: join(this.config.storagePath, 'MEMORY.md'),
    });

    this.dailyNotes = new DailyNotes({
      directory: join(this.config.storagePath, 'memory'),
    });

    this.sessionStore = new SessionStore({
      baseDir: this.config.storagePath,
      agentId: this.agentId,
    });
  }

  /**
   * Initialize the memory system
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.longTermMemory.init(),
      this.dailyNotes.init(),
      this.sessionStore.init(),
    ]);

    // Initialize DeepSeek client if API key available
    if (this.deepseekApiKey) {
      this.deepseek = new OpenAI({
        apiKey: this.deepseekApiKey,
        baseURL: 'https://api.deepseek.com',
      });
    }

    this.initialized = true;
  }

  /**
   * Start a new session
   */
  async startSession(): Promise<string> {
    await this.init();

    const { metadata, transcript } = await this.sessionStore.createSession();
    this.currentSession = transcript;
    this.currentSessionId = metadata.sessionId;

    return metadata.sessionId;
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string): Promise<boolean> {
    await this.init();

    const transcript = await this.sessionStore.loadSession(sessionId);
    if (!transcript) return false;

    this.currentSession = transcript;
    this.currentSessionId = sessionId;

    return true;
  }

  /**
   * Get the current session transcript
   */
  getCurrentSession(): Transcript | null {
    return this.currentSession;
  }

  // ============ Long-Term Memory Operations ============

  /**
   * Add a fact to long-term memory
   * @param skipDuplicates If true, won't add if fact already exists
   * @returns true if fact was added, false if skipped as duplicate
   */
  async addFact(
    section: string,
    fact: string,
    skipDuplicates: boolean = false
  ): Promise<boolean> {
    await this.init();
    return this.longTermMemory.addFact(section, fact, skipDuplicates);
  }

  /**
   * Remove a fact from long-term memory
   * @returns true if fact was found and removed, false if not found
   */
  async removeFact(section: string, fact: string): Promise<boolean> {
    await this.init();
    return this.longTermMemory.removeFact(section, fact);
  }

  /**
   * Get long-term memory contents
   */
  async getLongTermMemory(): Promise<string> {
    await this.init();
    return this.longTermMemory.read();
  }

  /**
   * Get a specific section from long-term memory
   */
  async getMemorySection(section: string): Promise<string | undefined> {
    await this.init();
    return this.longTermMemory.getSection(section);
  }

  // ============ Daily Notes Operations ============

  /**
   * Add an entry to today's daily notes
   */
  async addDailyNote(content: string, section?: string): Promise<void> {
    await this.init();
    await this.dailyNotes.addEntry(content, section);
  }

  /**
   * Add a decision to today's notes
   */
  async addDecision(decision: string): Promise<void> {
    await this.init();
    await this.dailyNotes.addDecision(decision);
  }

  /**
   * Get today's daily notes
   */
  async getTodayNotes(): Promise<string> {
    await this.init();
    return this.dailyNotes.readToday();
  }

  /**
   * Get yesterday's daily notes
   */
  async getYesterdayNotes(): Promise<string> {
    await this.init();
    return this.dailyNotes.readYesterday();
  }

  // ============ Session Operations ============

  /**
   * Add a user message to the current session
   */
  async addUserMessage(content: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }
    await this.currentSession.addUserMessage(content);
    await this.syncSession();
  }

  /**
   * Add an assistant message to the current session
   */
  async addAssistantMessage(content: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }
    await this.currentSession.addAssistantMessage(content);
    await this.syncSession();
  }

  /**
   * Sync session metadata
   */
  private async syncSession(): Promise<void> {
    if (!this.currentSession || !this.currentSessionId) return;
    await this.sessionStore.syncFromTranscript(
      this.currentSessionId,
      this.currentSession
    );
  }

  // ============ Context Generation ============

  /**
   * Generate system context for LLM prompts
   * This is what gets loaded at the start of each conversation
   */
  async getSystemContext(): Promise<string> {
    await this.init();

    const parts: string[] = [];

    // Long-term memory (always included)
    const longTerm = await this.longTermMemory.read();
    if (longTerm.trim()) {
      parts.push('### LONG-TERM MEMORY');
      parts.push(longTerm);
    }

    // Today's context
    const today = await this.dailyNotes.readToday();
    if (today.trim()) {
      parts.push(`### TODAY'S CONTEXT (${formatDate()})`);
      parts.push(today);
    }

    // Yesterday's context
    const yesterday = await this.dailyNotes.readYesterday();
    if (yesterday.trim()) {
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      parts.push(`### YESTERDAY'S CONTEXT (${formatDate(yesterdayDate)})`);
      parts.push(yesterday);
    }

    return parts.join('\n\n');
  }

  /**
   * Get full context including conversation history
   */
  async getFullContext(): Promise<string> {
    const systemContext = await this.getSystemContext();

    if (!this.currentSession) {
      return systemContext;
    }

    const history = this.currentSession.buildConversationHistory();
    if (history.length === 0) {
      return systemContext;
    }

    const historyStr = history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    return `${systemContext}\n\n### CONVERSATION HISTORY\n${historyStr}`;
  }

  // ============ Search Operations ============

  /**
   * Search across all memory files (grep-style)
   */
  async search(pattern: string): Promise<SearchResult[]> {
    await this.init();

    const results: SearchResult[] = [];

    // Search long-term memory
    const ltmMatches = await this.longTermMemory.search(pattern);
    for (const match of ltmMatches) {
      results.push({
        file: this.longTermMemory.getFilePath(),
        line: 0, // Line number would require more parsing
        content: match,
        matchedText: match,
      });
    }

    // Search daily notes
    const dailyMatches = await this.dailyNotes.search(pattern);
    for (const match of dailyMatches) {
      results.push({
        file: join(this.dailyNotes.getDirectory(), `${match.date}.md`),
        line: 0,
        content: match.line,
        matchedText: match.line,
      });
    }

    return results;
  }

  // ============ Compaction Operations ============

  /**
   * Check if compaction is needed
   */
  needsCompaction(): boolean {
    if (!this.currentSession) return false;

    const currentTokens = this.currentSession.getRecentTokens();
    const threshold =
      this.config.contextWindow -
      this.config.reserveTokens -
      this.config.softThresholdTokens;

    return currentTokens > threshold;
  }

  /**
   * Check if pre-compaction memory flush is needed
   */
  needsMemoryFlush(): boolean {
    if (!this.currentSession) return false;

    const currentTokens = this.currentSession.getRecentTokens();
    const softThreshold =
      this.config.contextWindow -
      this.config.reserveTokens -
      this.config.softThresholdTokens;

    return currentTokens > softThreshold;
  }

  /**
   * Perform pre-compaction memory flush
   * Writes important context to daily notes before compaction
   */
  async flushToMemory(importantContext: string): Promise<void> {
    await this.dailyNotes.addEntry(
      `[Pre-compaction flush] ${importantContext}`,
      'Session Notes'
    );
  }

  /**
   * Perform compaction on the current session
   * Uses DeepSeek to summarize older conversation
   */
  async compact(): Promise<CompactionResult | null> {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }

    if (!this.deepseek) {
      throw new Error('DeepSeek client not initialized. Set DEEPSEEK_API_KEY.');
    }

    const entries = this.currentSession.getRecentEntries();
    if (entries.length < 5) {
      return null; // Not enough to compact
    }

    // Find entries to compact (keep recent ones)
    const totalTokens = entries.reduce((sum, e) => sum + (e.tokenCount || 0), 0);
    let tokensToKeep = 0;
    let keepFromIndex = entries.length;

    // Walk backwards to find where to cut
    for (let i = entries.length - 1; i >= 0; i--) {
      const entryTokens = entries[i].tokenCount || 0;
      if (tokensToKeep + entryTokens > this.config.keepRecentTokens) {
        keepFromIndex = i + 1;
        break;
      }
      tokensToKeep += entryTokens;
    }

    if (keepFromIndex <= 1) {
      return null; // Nothing to compact
    }

    // Get entries to summarize
    const toSummarize = entries.slice(0, keepFromIndex);
    const conversationToSummarize = toSummarize
      .filter((e) => e.type === 'message')
      .map((e) => `${e.role?.toUpperCase() || 'SYSTEM'}: ${e.content}`)
      .join('\n\n');

    // Use DeepSeek for cost-effective summarization
    const response = await this.deepseek.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation concisely, preserving key decisions, facts learned, and important context. Focus on information that would be needed to continue the conversation:\n\n${conversationToSummarize}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content || '';

    // Add compaction entry
    const removedIds = toSummarize.map((e) => e.id);
    await this.currentSession.addCompaction(summary, removedIds);

    const tokensSaved =
      totalTokens - tokensToKeep - countTokens(summary);

    await this.syncSession();

    return {
      summary,
      removedEntryCount: toSummarize.length,
      tokensSaved,
      newTotalTokens: this.currentSession.getRecentTokens(),
    };
  }

  // ============ Utility Methods ============

  /**
   * Get current token count
   */
  getCurrentTokens(): number {
    if (!this.currentSession) return 0;
    return this.currentSession.getRecentTokens();
  }

  /**
   * Get configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * Get storage path
   */
  getStoragePath(): string {
    return this.config.storagePath;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * List all sessions
   */
  async listSessions() {
    await this.init();
    return this.sessionStore.getSessions();
  }

  /**
   * Get the underlying components for advanced usage
   */
  getComponents() {
    return {
      longTermMemory: this.longTermMemory,
      dailyNotes: this.dailyNotes,
      sessionStore: this.sessionStore,
    };
  }

  /**
   * Export all memory files to a zip archive
   * @param outputPath Directory to write the zip file (defaults to current directory)
   * @returns Path to the created zip file
   */
  async export(outputPath: string = '.'): Promise<string> {
    await this.init();

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `memory-export-${date}.zip`;
    const fullPath = join(outputPath, filename);

    return new Promise(async (resolve, reject) => {
      const output = createWriteStream(fullPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve(fullPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add all .md files from storage
      await this.addFilesToArchive(archive, this.config.storagePath, '');

      await archive.finalize();
    });
  }

  /**
   * Recursively add .md files to archive
   */
  private async addFilesToArchive(
    archive: archiver.Archiver,
    dir: string,
    prefix: string
  ): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const archivePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Skip agents directory (session data)
          if (entry.name === 'agents') continue;
          await this.addFilesToArchive(archive, fullPath, archivePath);
        } else if (entry.name.endsWith('.md')) {
          archive.file(fullPath, { name: archivePath });
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }
}
