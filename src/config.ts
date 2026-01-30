/**
 * Configuration management for memory-cli
 *
 * Handles loading, saving, and managing config from ~/.memory-cli/config.yaml
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import yaml from 'js-yaml';
import { MemoryConfig, DEFAULT_CONFIG } from './types.js';

/** Path to config directory */
export const CONFIG_DIR = join(process.env.HOME || '', '.memory-cli');

/** Path to config file */
export const CONFIG_PATH = join(CONFIG_DIR, 'config.yaml');

/** Default config file contents (with comments) */
const DEFAULT_CONFIG_YAML = `# Memory CLI Configuration
# Documentation: https://github.com/yourusername/moltbot-inspired-memory

# Memory storage location
storagePath: ~/.memory-test

# Timezone for timestamps (IANA format)
timezone: UTC

# Date format for daily notes
dateFormat: YYYY-MM-DD

# Memory sections (customizable)
sections:
  - Preferences
  - People
  - Projects
  - Facts

# Token limits for compaction
contextWindow: 100000
reserveTokens: 4000
softThresholdTokens: 10000
keepRecentTokens: 20000
`;

/**
 * Expand ~ to home directory in paths
 */
function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(process.env.HOME || '', path.slice(2));
  }
  return path;
}

/**
 * Contract home directory to ~ in paths for display/storage
 */
function contractPath(path: string): string {
  const home = process.env.HOME || '';
  if (home && path.startsWith(home)) {
    return '~' + path.slice(home.length);
  }
  return path;
}

/**
 * Load config from file, creating default if needed
 */
export function loadConfig(): MemoryConfig {
  // Create config directory if it doesn't exist
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Create default config if it doesn't exist
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, DEFAULT_CONFIG_YAML, 'utf-8');
    return { ...DEFAULT_CONFIG };
  }

  // Load and parse config
  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const loaded = yaml.load(content) as Partial<MemoryConfig>;

    // Merge with defaults, expanding paths
    const config: MemoryConfig = {
      ...DEFAULT_CONFIG,
      ...loaded,
    };

    // Expand ~ in storagePath
    config.storagePath = expandPath(config.storagePath);

    return config;
  } catch (error) {
    console.error(`Warning: Could not parse ${CONFIG_PATH}, using defaults`);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save config to file
 */
export function saveConfig(config: MemoryConfig): void {
  // Create config directory if it doesn't exist
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Contract paths for storage
  const toSave = {
    ...config,
    storagePath: contractPath(config.storagePath),
  };

  const content = yaml.dump(toSave, {
    indent: 2,
    lineWidth: 80,
    quotingType: '"',
  });

  writeFileSync(CONFIG_PATH, content, 'utf-8');
}

/**
 * Reset config to defaults
 */
export function resetConfig(): void {
  // Create config directory if it doesn't exist
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_PATH, DEFAULT_CONFIG_YAML, 'utf-8');
}

/**
 * Get formatted config for display
 */
export function formatConfig(config: MemoryConfig): string {
  const lines = [
    '# Current Configuration',
    `# File: ${CONFIG_PATH}`,
    '',
  ];

  // Format with contracted paths for display
  const display = {
    ...config,
    storagePath: contractPath(config.storagePath),
  };

  lines.push(yaml.dump(display, {
    indent: 2,
    lineWidth: 80,
  }));

  return lines.join('\n');
}

/**
 * Check if config file exists
 */
export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}
