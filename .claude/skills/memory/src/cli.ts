#!/usr/bin/env node
/**
 * Memory CLI - For use by Claude Code
 *
 * Commands:
 *   remember <section> <fact>   - Store a fact in MEMORY.md
 *   note <content>              - Add to today's notes
 *   decide <content>            - Record a decision
 *   recall                      - Show what I know (MEMORY.md)
 *   today                       - Show today's notes
 *   search <query>              - Search all memory
 *   context                     - Full context for prompts
 *   config                      - Show/edit configuration
 *   export                      - Export memory to zip file
 */

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { MemoryManager } from './memory/MemoryManager.js';
import { freeEncoder } from './utils/tokens.js';
import {
  loadConfig,
  resetConfig,
  formatConfig,
  CONFIG_PATH,
} from './config.js';

const USAGE = `
Memory CLI

Commands:
  remember <section> <fact>   Store a fact (sections: Preferences, People, Projects, Facts)
  forget <section> <fact>     Remove a fact from memory
  note <content>              Add to today's session notes
  decide <content>            Record a decision made
  idea <content>              Record an idea
  recall                      Show MEMORY.md contents
  today                       Show today's notes
  search <query>              Search all memory files
  context                     Generate full system context
  time                        Show current date and time
  config                      Show current configuration
  config --edit               Open config in $EDITOR
  config --reset              Reset config to defaults
  export                      Export memory to zip file
  export --output <path>      Export to custom location
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  // Load config from file
  const config = loadConfig();

  const memory = new MemoryManager({
    agentId: 'claude-code',
    ...config,
  });

  try {
    await memory.init();

    switch (command) {
      case 'remember': {
        const section = args[1];
        const fact = args.slice(2).join(' ');
        if (!section || !fact) {
          console.error('Usage: remember <section> <fact>');
          console.error('Sections: Preferences, People, Projects, Facts');
          process.exit(1);
        }
        const added = await memory.addFact(section, fact, true);
        if (added) {
          console.log(`✓ Stored in ${section}: "${fact}"`);
        } else {
          console.log(`Already known: "${fact}"`);
        }
        break;
      }

      case 'forget': {
        const section = args[1];
        const fact = args.slice(2).join(' ');
        if (!section || !fact) {
          console.error('Usage: forget <section> <fact>');
          console.error('Sections: Preferences, People, Projects, Facts');
          process.exit(1);
        }
        const removed = await memory.removeFact(section, fact);
        if (removed) {
          console.log(`✓ Removed from ${section}: "${fact}"`);
        } else {
          console.log(`Not found in ${section}: "${fact}"`);
        }
        break;
      }

      case 'note': {
        const content = args.slice(1).join(' ');
        if (!content) {
          console.error('Usage: note <content>');
          process.exit(1);
        }
        await memory.addDailyNote(content);
        console.log(`✓ Added note: "${content}"`);
        break;
      }

      case 'decide': {
        const decision = args.slice(1).join(' ');
        if (!decision) {
          console.error('Usage: decide <content>');
          process.exit(1);
        }
        await memory.addDecision(decision);
        console.log(`✓ Recorded decision: "${decision}"`);
        break;
      }

      case 'idea': {
        const idea = args.slice(1).join(' ');
        if (!idea) {
          console.error('Usage: idea <content>');
          process.exit(1);
        }
        const { dailyNotes } = memory.getComponents();
        await dailyNotes.addIdea(idea);
        console.log(`✓ Recorded idea: "${idea}"`);
        break;
      }

      case 'recall': {
        const content = await memory.getLongTermMemory();
        console.log(content);
        break;
      }

      case 'today': {
        const content = await memory.getTodayNotes();
        if (content) {
          console.log(content);
        } else {
          console.log('No notes for today yet.');
        }
        break;
      }

      case 'search': {
        const query = args.slice(1).join(' ');
        if (!query) {
          console.error('Usage: search <query>');
          process.exit(1);
        }
        const results = await memory.search(query);
        if (results.length === 0) {
          console.log(`No matches for "${query}"`);
        } else {
          console.log(`Found ${results.length} matches:\n`);
          for (const result of results) {
            console.log(`  ${result.content}`);
          }
        }
        break;
      }

      case 'context': {
        const context = await memory.getSystemContext();
        console.log(context);
        break;
      }

      case 'time': {
        const now = new Date();
        const timezone = config.timezone || process.env.MEMORY_TIMEZONE || 'UTC';
        const formatted = now.toLocaleString('en-US', {
          timeZone: timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        console.log(`${timezone}: ${formatted}`);
        break;
      }

      case 'config': {
        const flag = args[1];

        if (flag === '--edit') {
          const editor = process.env.EDITOR || 'nano';
          const child = spawn(editor, [CONFIG_PATH], {
            stdio: 'inherit',
          });
          child.on('exit', (code) => {
            process.exit(code || 0);
          });
          return; // Don't free encoder yet
        }

        if (flag === '--reset') {
          resetConfig();
          console.log(`✓ Config reset to defaults: ${CONFIG_PATH}`);
          break;
        }

        // Show current config
        console.log(formatConfig(config));
        break;
      }

      case 'export': {
        let outputPath = '.';

        // Parse --output flag
        const outputIdx = args.indexOf('--output');
        if (outputIdx !== -1 && args[outputIdx + 1]) {
          outputPath = args[outputIdx + 1];
        }

        const zipPath = await memory.export(outputPath);
        console.log(`✓ Exported memory to: ${zipPath}`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(USAGE);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    freeEncoder();
  }
}

main();
