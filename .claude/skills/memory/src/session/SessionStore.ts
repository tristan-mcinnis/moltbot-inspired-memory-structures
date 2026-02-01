/**
 * Session Store - Manages session metadata
 *
 * Tracks all sessions in a sessions.json file with metadata
 * about creation time, token counts, and compaction history.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SessionMetadata } from '../types.js';
import { Transcript } from './Transcript.js';

export interface SessionStoreConfig {
  /** Base directory for session storage */
  baseDir: string;
  /** Agent ID for namespacing sessions */
  agentId: string;
}

interface SessionsFile {
  sessions: SessionMetadata[];
}

export class SessionStore {
  private baseDir: string;
  private agentId: string;
  private sessionsFilePath: string;
  private sessions: SessionMetadata[] = [];
  private loaded: boolean = false;

  constructor(config: SessionStoreConfig) {
    this.baseDir = config.baseDir;
    this.agentId = config.agentId;
    this.sessionsFilePath = join(
      this.baseDir,
      'agents',
      this.agentId,
      'sessions.json'
    );
  }

  /**
   * Initialize the session store
   */
  async init(): Promise<void> {
    const dir = dirname(this.sessionsFilePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await this.load();
  }

  /**
   * Load sessions from disk
   */
  private async load(): Promise<void> {
    if (this.loaded) return;

    if (!existsSync(this.sessionsFilePath)) {
      this.sessions = [];
      this.loaded = true;
      return;
    }

    try {
      const content = await readFile(this.sessionsFilePath, 'utf-8');
      const data = JSON.parse(content) as SessionsFile;
      this.sessions = data.sessions || [];
    } catch {
      this.sessions = [];
    }

    this.loaded = true;
  }

  /**
   * Save sessions to disk
   */
  private async save(): Promise<void> {
    const data: SessionsFile = { sessions: this.sessions };
    await writeFile(this.sessionsFilePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Create a new session
   */
  async createSession(): Promise<{ metadata: SessionMetadata; transcript: Transcript }> {
    await this.load();

    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const metadata: SessionMetadata = {
      sessionId,
      agentId: this.agentId,
      createdAt: now,
      updatedAt: now,
      totalTokens: 0,
      entryCount: 0,
      compactionCount: 0,
    };

    this.sessions.push(metadata);
    await this.save();

    const transcriptPath = this.getTranscriptPath(sessionId);
    const transcript = new Transcript({ filePath: transcriptPath });
    await transcript.init();

    return { metadata, transcript };
  }

  /**
   * Get the transcript file path for a session
   */
  getTranscriptPath(sessionId: string): string {
    return join(
      this.baseDir,
      'agents',
      this.agentId,
      'sessions',
      `${sessionId}.jsonl`
    );
  }

  /**
   * Load an existing session's transcript
   */
  async loadSession(sessionId: string): Promise<Transcript | null> {
    await this.load();

    const metadata = this.sessions.find((s) => s.sessionId === sessionId);
    if (!metadata) return null;

    const transcriptPath = this.getTranscriptPath(sessionId);
    const transcript = new Transcript({ filePath: transcriptPath });
    await transcript.load();

    return transcript;
  }

  /**
   * Update session metadata
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionMetadata, 'sessionId' | 'agentId' | 'createdAt'>>
  ): Promise<void> {
    await this.load();

    const index = this.sessions.findIndex((s) => s.sessionId === sessionId);
    if (index === -1) return;

    this.sessions[index] = {
      ...this.sessions[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.save();
  }

  /**
   * Sync session metadata from transcript
   */
  async syncFromTranscript(
    sessionId: string,
    transcript: Transcript
  ): Promise<void> {
    await this.updateSession(sessionId, {
      totalTokens: transcript.getTotalTokens(),
      entryCount: transcript.getEntryCount(),
      compactionCount: transcript.getCompactionCount(),
    });
  }

  /**
   * Get all sessions
   */
  async getSessions(): Promise<SessionMetadata[]> {
    await this.load();
    return [...this.sessions];
  }

  /**
   * Get the most recent session
   */
  async getMostRecentSession(): Promise<SessionMetadata | null> {
    await this.load();

    if (this.sessions.length === 0) return null;

    return this.sessions.reduce((latest, current) => {
      return new Date(current.updatedAt) > new Date(latest.updatedAt)
        ? current
        : latest;
    });
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    await this.load();

    const index = this.sessions.findIndex((s) => s.sessionId === sessionId);
    if (index === -1) return false;

    this.sessions.splice(index, 1);
    await this.save();

    // Note: This doesn't delete the transcript file
    // Could add file deletion here if needed

    return true;
  }

  /**
   * Get the sessions file path
   */
  getSessionsFilePath(): string {
    return this.sessionsFilePath;
  }

  /**
   * Get the base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
