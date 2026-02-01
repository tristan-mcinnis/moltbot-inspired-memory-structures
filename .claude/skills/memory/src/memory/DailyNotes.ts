/**
 * Daily Notes (memory/YYYY-MM-DD.md) management
 *
 * Handles episodic memory - day-to-day notes and context.
 * Append-only diary format with timestamped entries.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { formatDate, formatTime, createSection } from '../utils/markdown.js';

export interface DailyNotesConfig {
  /** Directory for daily note files */
  directory: string;
}

export class DailyNotes {
  private directory: string;

  constructor(config: DailyNotesConfig) {
    this.directory = config.directory;
  }

  /**
   * Initialize the daily notes directory
   */
  async init(): Promise<void> {
    if (!existsSync(this.directory)) {
      await mkdir(this.directory, { recursive: true });
    }
  }

  /**
   * Get the file path for a specific date
   */
  private getFilePath(date: Date = new Date()): string {
    return join(this.directory, `${formatDate(date)}.md`);
  }

  /**
   * Create initial content for a new daily note
   */
  private createInitialContent(date: Date): string {
    const dateStr = formatDate(date);
    return `# ${dateStr}

## Session Notes

## Decisions Made

## Ideas

## Tasks

`;
  }

  /**
   * Read today's notes
   */
  async readToday(): Promise<string> {
    return this.readDate(new Date());
  }

  /**
   * Read yesterday's notes
   */
  async readYesterday(): Promise<string> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.readDate(yesterday);
  }

  /**
   * Read notes for a specific date
   */
  async readDate(date: Date): Promise<string> {
    const filePath = this.getFilePath(date);

    try {
      return await readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }

  /**
   * Ensure today's file exists
   */
  private async ensureToday(): Promise<string> {
    const filePath = this.getFilePath();

    if (!existsSync(filePath)) {
      await this.init();
      const content = this.createInitialContent(new Date());
      await writeFile(filePath, content, 'utf-8');
      return content;
    }

    return await readFile(filePath, 'utf-8');
  }

  /**
   * Add a timestamped entry to today's notes
   */
  async addEntry(
    content: string,
    section: string = 'Session Notes'
  ): Promise<void> {
    let fileContent = await this.ensureToday();
    const timestamp = formatTime();
    const entry = `- [${timestamp}] ${content}`;

    const sectionPattern = new RegExp(
      `^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'm'
    );

    if (!sectionPattern.test(fileContent)) {
      // Add section if it doesn't exist
      fileContent = fileContent.trimEnd() + `\n\n## ${section}\n`;
    }

    // Find the section and append entry
    const lines = fileContent.split('\n');
    let sectionIndex = -1;
    let insertIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
      if (sectionPattern.test(lines[i])) {
        sectionIndex = i;
        // Find next section or end of file
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].match(/^##\s+/)) {
            insertIndex = j;
            break;
          }
        }
        if (sectionIndex !== -1 && insertIndex === lines.length) {
          insertIndex = lines.length;
        }
        break;
      }
    }

    // Insert the entry before the next section (or at end)
    // Remove trailing empty lines first
    while (insertIndex > 0 && lines[insertIndex - 1].trim() === '') {
      insertIndex--;
    }

    lines.splice(insertIndex, 0, entry);

    const newContent = lines.join('\n');
    await writeFile(this.getFilePath(), newContent, 'utf-8');
  }

  /**
   * Add a decision to today's notes
   */
  async addDecision(decision: string): Promise<void> {
    await this.addEntry(decision, 'Decisions Made');
  }

  /**
   * Add an idea to today's notes
   */
  async addIdea(idea: string): Promise<void> {
    await this.addEntry(idea, 'Ideas');
  }

  /**
   * Add a task to today's notes
   */
  async addTask(task: string): Promise<void> {
    await this.addEntry(task, 'Tasks');
  }

  /**
   * Get all available daily note dates
   */
  async listDates(): Promise<string[]> {
    try {
      const files = await readdir(this.directory);
      return files
        .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
        .map((f) => basename(f, '.md'))
        .sort()
        .reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read multiple recent days of notes
   */
  async readRecent(days: number = 7): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const date = new Date();

    for (let i = 0; i < days; i++) {
      const content = await this.readDate(date);
      if (content) {
        results.set(formatDate(date), content);
      }
      date.setDate(date.getDate() - 1);
    }

    return results;
  }

  /**
   * Search across all daily notes for a pattern
   */
  async search(pattern: string): Promise<Array<{ date: string; line: string }>> {
    const dates = await this.listDates();
    const regex = new RegExp(pattern, 'gi');
    const results: Array<{ date: string; line: string }> = [];

    for (const dateStr of dates) {
      const date = new Date(dateStr);
      const content = await this.readDate(date);
      const lines = content.split('\n');

      for (const line of lines) {
        if (regex.test(line)) {
          results.push({ date: dateStr, line });
        }
      }
    }

    return results;
  }

  /**
   * Get the directory path
   */
  getDirectory(): string {
    return this.directory;
  }
}
