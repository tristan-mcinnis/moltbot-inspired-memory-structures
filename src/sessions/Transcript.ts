/**
 * Session Transcript (JSONL) management
 *
 * Handles append-only session logs with tree structure.
 * Each entry has an id and parentId for threading.
 */

import { open, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TranscriptEntry } from '../memory/types.js';
import { countTokens } from '../utils/tokens.js';

export interface TranscriptConfig {
  /** Path to the JSONL transcript file */
  filePath: string;
}

export class Transcript {
  private filePath: string;
  private entries: TranscriptEntry[] = [];
  private totalTokens: number = 0;
  private loaded: boolean = false;

  constructor(config: TranscriptConfig) {
    this.filePath = config.filePath;
  }

  /**
   * Initialize the transcript file
   */
  async init(): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (!existsSync(this.filePath)) {
      // Create empty file
      const handle = await open(this.filePath, 'w');
      await handle.close();
    }

    await this.load();
  }

  /**
   * Load all entries from the transcript file
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    if (!existsSync(this.filePath)) {
      this.entries = [];
      this.totalTokens = 0;
      this.loaded = true;
      return;
    }

    const handle = await open(this.filePath, 'r');
    const content = await handle.readFile('utf-8');
    await handle.close();

    this.entries = [];
    this.totalTokens = 0;

    if (content.trim()) {
      const lines = content.trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line) as TranscriptEntry;
            this.entries.push(entry);
            this.totalTokens += entry.tokenCount || 0;
          } catch {
            console.error('Failed to parse transcript line:', line);
          }
        }
      }
    }

    this.loaded = true;
  }

  /**
   * Append a new entry to the transcript
   */
  async append(
    entry: Omit<TranscriptEntry, 'id' | 'timestamp' | 'tokenCount'>
  ): Promise<TranscriptEntry> {
    await this.load();

    const tokenCount = countTokens(entry.content);
    const fullEntry: TranscriptEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      tokenCount,
    };

    const handle = await open(this.filePath, 'a');
    await handle.write(JSON.stringify(fullEntry) + '\n');
    await handle.close();

    this.entries.push(fullEntry);
    this.totalTokens += tokenCount;

    return fullEntry;
  }

  /**
   * Add a user message
   */
  async addUserMessage(
    content: string,
    parentId: string | null = null
  ): Promise<TranscriptEntry> {
    const parent = parentId || this.getLastEntryId();
    return this.append({
      type: 'message',
      role: 'user',
      content,
      parentId: parent,
    });
  }

  /**
   * Add an assistant message
   */
  async addAssistantMessage(
    content: string,
    parentId: string | null = null
  ): Promise<TranscriptEntry> {
    const parent = parentId || this.getLastEntryId();
    return this.append({
      type: 'message',
      role: 'assistant',
      content,
      parentId: parent,
    });
  }

  /**
   * Add a tool call entry
   */
  async addToolCall(
    toolName: string,
    input: unknown,
    parentId: string | null = null
  ): Promise<TranscriptEntry> {
    const parent = parentId || this.getLastEntryId();
    return this.append({
      type: 'tool_call',
      content: JSON.stringify({ tool: toolName, input }),
      parentId: parent,
      metadata: { toolName },
    });
  }

  /**
   * Add a tool result entry
   */
  async addToolResult(
    result: string,
    parentId: string
  ): Promise<TranscriptEntry> {
    return this.append({
      type: 'tool_result',
      content: result,
      parentId,
    });
  }

  /**
   * Add a compaction summary
   */
  async addCompaction(
    summary: string,
    removedEntryIds: string[]
  ): Promise<TranscriptEntry> {
    return this.append({
      type: 'compaction',
      content: summary,
      parentId: null,
      metadata: { removedEntryIds, removedCount: removedEntryIds.length },
    });
  }

  /**
   * Get all entries
   */
  getEntries(): TranscriptEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries after compaction (recent entries only)
   */
  getRecentEntries(): TranscriptEntry[] {
    // Find the last compaction entry
    let lastCompactionIndex = -1;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].type === 'compaction') {
        lastCompactionIndex = i;
        break;
      }
    }

    if (lastCompactionIndex === -1) {
      return [...this.entries];
    }

    // Return compaction + all entries after it
    return this.entries.slice(lastCompactionIndex);
  }

  /**
   * Get total token count
   */
  getTotalTokens(): number {
    return this.totalTokens;
  }

  /**
   * Get token count for recent entries only
   */
  getRecentTokens(): number {
    const recent = this.getRecentEntries();
    return recent.reduce((sum, e) => sum + (e.tokenCount || 0), 0);
  }

  /**
   * Get the last entry ID
   */
  getLastEntryId(): string | null {
    if (this.entries.length === 0) return null;
    return this.entries[this.entries.length - 1].id;
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Get compaction count
   */
  getCompactionCount(): number {
    return this.entries.filter((e) => e.type === 'compaction').length;
  }

  /**
   * Build conversation history from entries (for LLM context)
   */
  buildConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    const recent = this.getRecentEntries();
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const entry of recent) {
      if (entry.type === 'compaction') {
        // Include compaction summary as a system-like message
        messages.push({
          role: 'assistant',
          content: `[Previous conversation summary]\n${entry.content}`,
        });
      } else if (entry.type === 'message' && entry.role) {
        messages.push({
          role: entry.role,
          content: entry.content,
        });
      }
    }

    return messages;
  }

  /**
   * Get the file path
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Force reload from disk
   */
  async reload(): Promise<void> {
    this.loaded = false;
    this.entries = [];
    this.totalTokens = 0;
    await this.load();
  }
}
