/**
 * Long-Term Memory (MEMORY.md) management
 *
 * Handles curated facts, preferences, and relationships.
 * This is the "who you are" storage - private, persistent knowledge.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseSections, appendToSection } from '../utils/markdown.js';

export interface LongTermMemoryConfig {
  /** Path to MEMORY.md file */
  filePath: string;
}

export class LongTermMemory {
  private filePath: string;
  private cache: string | null = null;

  constructor(config: LongTermMemoryConfig) {
    this.filePath = config.filePath;
  }

  /**
   * Initialize the memory file if it doesn't exist
   */
  async init(): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (!existsSync(this.filePath)) {
      const initialContent = `# Long-Term Memory

## Preferences

## People

## Projects

## Facts

`;
      await writeFile(this.filePath, initialContent, 'utf-8');
      this.cache = initialContent;
    }
  }

  /**
   * Read the entire MEMORY.md file
   */
  async read(): Promise<string> {
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      this.cache = await readFile(this.filePath, 'utf-8');
      return this.cache;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.init();
        return this.cache!;
      }
      throw error;
    }
  }

  /**
   * Get content of a specific section
   */
  async getSection(sectionTitle: string): Promise<string | undefined> {
    const content = await this.read();
    const sections = parseSections(content);
    return sections.get(sectionTitle);
  }

  /**
   * Check if a fact already exists in a section
   */
  async hasFact(section: string, fact: string): Promise<boolean> {
    const sectionContent = await this.getSection(section);
    if (!sectionContent) return false;

    // Check if the exact fact exists as a bullet point
    const lines = sectionContent.split('\n');
    const normalizedFact = fact.trim().toLowerCase();

    return lines.some((line) => {
      const bullet = line.replace(/^\s*[-*+]\s*/, '').trim().toLowerCase();
      return bullet === normalizedFact;
    });
  }

  /**
   * Add a fact to a specific section
   * @param skipDuplicates If true, won't add if fact already exists
   * @returns true if fact was added, false if skipped as duplicate
   */
  async addFact(
    section: string,
    fact: string,
    skipDuplicates: boolean = false
  ): Promise<boolean> {
    if (skipDuplicates && (await this.hasFact(section, fact))) {
      return false;
    }

    const content = await this.read();
    const bulletPoint = `- ${fact}`;
    const newContent = appendToSection(content, section, bulletPoint, true);

    await writeFile(this.filePath, newContent, 'utf-8');
    this.cache = newContent;
    return true;
  }

  /**
   * Add multiple facts to a section
   */
  async addFacts(section: string, facts: string[]): Promise<void> {
    const content = await this.read();
    const bulletPoints = facts.map((f) => `- ${f}`).join('\n');
    const newContent = appendToSection(content, section, bulletPoints, true);

    await writeFile(this.filePath, newContent, 'utf-8');
    this.cache = newContent;
  }

  /**
   * Replace the entire content of a section
   */
  async setSection(sectionTitle: string, content: string): Promise<void> {
    const fileContent = await this.read();
    const lines = fileContent.split('\n');
    const sectionPattern = new RegExp(
      `^##\\s+${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`
    );

    let sectionStart = -1;
    let sectionEnd = lines.length;

    for (let i = 0; i < lines.length; i++) {
      if (sectionPattern.test(lines[i])) {
        sectionStart = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].match(/^##\s+/)) {
            sectionEnd = j;
            break;
          }
        }
        break;
      }
    }

    let newContent: string;
    if (sectionStart === -1) {
      // Section doesn't exist, add it
      newContent =
        fileContent.trimEnd() + `\n\n## ${sectionTitle}\n${content}\n`;
    } else {
      // Replace section content
      const before = lines.slice(0, sectionStart + 1);
      const after = lines.slice(sectionEnd);
      newContent = [...before, content, '', ...after].join('\n');
    }

    await writeFile(this.filePath, newContent, 'utf-8');
    this.cache = newContent;
  }

  /**
   * Search memory for a pattern (case-insensitive)
   */
  async search(pattern: string): Promise<string[]> {
    const content = await this.read();
    const regex = new RegExp(pattern, 'gi');
    const lines = content.split('\n');

    return lines.filter((line) => regex.test(line));
  }

  /**
   * Clear the cache (force re-read on next access)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Get the file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}
