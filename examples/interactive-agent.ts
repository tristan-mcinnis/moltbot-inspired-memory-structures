#!/usr/bin/env node
/**
 * Interactive agent with persistent memory
 *
 * This demonstrates the memory system in action:
 * - Loads MEMORY.md and daily notes as context
 * - Maintains conversation in session transcript
 * - Agent can store facts and notes via tool calls
 *
 * Run with: npm run agent
 */

import Anthropic from '@anthropic-ai/sdk';
import { createInterface } from 'node:readline';
import { MemoryManager } from '../src/memory/MemoryManager.js';
import { freeEncoder } from '../src/utils/tokens.js';

const SYSTEM_PROMPT = `You are a helpful assistant with persistent memory.

You have access to your memory context below, which includes:
- Long-term facts about the user (MEMORY.md)
- Today's and yesterday's notes

When you learn something important about the user, use the store_fact tool to remember it.
When something notable happens in conversation, use the add_note tool to record it.

Be conversational and reference your memories naturally when relevant.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'store_fact',
    description:
      'Store a fact in long-term memory. Use for preferences, people, projects, or other persistent info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        section: {
          type: 'string',
          description: 'Section name: Preferences, People, Projects, or Facts',
          enum: ['Preferences', 'People', 'Projects', 'Facts'],
        },
        fact: {
          type: 'string',
          description: 'The fact to remember',
        },
      },
      required: ['section', 'fact'],
    },
  },
  {
    name: 'add_note',
    description:
      "Add a note to today's daily notes. Use for session observations, decisions, or ideas.",
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'The note content',
        },
        section: {
          type: 'string',
          description: 'Section: Session Notes, Decisions Made, Ideas, or Tasks',
          enum: ['Session Notes', 'Decisions Made', 'Ideas', 'Tasks'],
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'search_memory',
    description: 'Search across all memory files for a pattern',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (supports regex)',
        },
      },
      required: ['query'],
    },
  },
];

async function handleToolCall(
  memory: MemoryManager,
  toolName: string,
  toolInput: Record<string, string>
): Promise<string> {
  switch (toolName) {
    case 'store_fact': {
      const added = await memory.addFact(toolInput.section, toolInput.fact, true);
      if (added) {
        return `Stored in ${toolInput.section}: "${toolInput.fact}"`;
      } else {
        return `Already knew: "${toolInput.fact}"`;
      }
    }
    case 'add_note': {
      await memory.addDailyNote(toolInput.content, toolInput.section || 'Session Notes');
      return `Added note: "${toolInput.content}"`;
    }
    case 'search_memory': {
      const results = await memory.search(toolInput.query);
      if (results.length === 0) {
        return `No matches found for "${toolInput.query}"`;
      }
      return `Found ${results.length} matches:\n${results.map((r) => `- ${r.content}`).join('\n')}`;
    }
    default:
      return `Unknown tool: ${toolName}`;
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable required');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Memory Agent - Interactive Test');
  console.log('='.repeat(60));
  console.log('\nCommands:');
  console.log('  /memory  - Show current memory context');
  console.log('  /tokens  - Show token usage');
  console.log('  /quit    - Exit\n');

  const memory = new MemoryManager({
    agentId: 'interactive-agent',
  });
  await memory.init();
  await memory.startSession();

  const anthropic = new Anthropic();
  const messages: Anthropic.MessageParam[] = [];

  // Build initial context
  const memoryContext = await memory.getSystemContext();
  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${memoryContext}`;

  console.log('Memory loaded. Start chatting!\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed === '/quit') {
        console.log('\nGoodbye!');
        freeEncoder();
        rl.close();
        return;
      }

      if (trimmed === '/memory') {
        const ctx = await memory.getSystemContext();
        console.log('\n--- Memory Context ---');
        console.log(ctx);
        console.log('--- End Context ---\n');
        prompt();
        return;
      }

      if (trimmed === '/tokens') {
        console.log(`\nSession tokens: ${memory.getCurrentTokens()}`);
        console.log(`Needs compaction: ${memory.needsCompaction()}\n`);
        prompt();
        return;
      }

      // Add user message
      messages.push({ role: 'user', content: trimmed });
      await memory.addUserMessage(trimmed);

      try {
        // Get response from Claude
        let response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: fullSystemPrompt,
          tools: TOOLS,
          messages,
        });

        // Handle tool calls in a loop
        while (response.stop_reason === 'tool_use') {
          const assistantContent = response.content;
          messages.push({ role: 'assistant', content: assistantContent });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of assistantContent) {
            if (block.type === 'tool_use') {
              console.log(`\n[Tool: ${block.name}]`);
              const result = await handleToolCall(
                memory,
                block.name,
                block.input as Record<string, string>
              );
              console.log(`[Result: ${result}]\n`);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              });
            }
          }

          messages.push({ role: 'user', content: toolResults });

          response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: fullSystemPrompt,
            tools: TOOLS,
            messages,
          });
        }

        // Extract and display text response
        const textContent = response.content.find((b) => b.type === 'text');
        const assistantText = textContent?.type === 'text' ? textContent.text : '';

        if (assistantText) {
          console.log(`\nAssistant: ${assistantText}\n`);
          messages.push({ role: 'assistant', content: response.content });
          await memory.addAssistantMessage(assistantText);
        }
      } catch (error) {
        console.error('\nError:', error);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
