/**
 * Demo script to test the memory system
 *
 * Run with: npm run demo
 * Run with reset: npm run demo -- --reset
 */

import { MemoryManager } from './memory/MemoryManager.js';
import { freeEncoder } from './utils/tokens.js';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

async function main() {
  const shouldReset = process.argv.includes('--reset');
  const storagePath = `${process.env.HOME}/.memory-test`;

  console.log('='.repeat(60));
  console.log('Memory System Demo');
  console.log('='.repeat(60));

  // Reset storage if requested
  if (shouldReset && existsSync(storagePath)) {
    console.log('\nResetting storage...');
    await rm(storagePath, { recursive: true });
    console.log('   Cleared ~/.memory-test');
  }

  // Create memory manager with custom storage path for testing
  const memory = new MemoryManager({
    storagePath,
    agentId: 'demo-agent',
  });

  // Initialize the system
  console.log('\n1. Initializing memory system...');
  await memory.init();
  console.log(`   Storage path: ${memory.getStoragePath()}`);

  // Add some facts to long-term memory (with deduplication)
  console.log('\n2. Adding facts to long-term memory...');
  const facts = [
    { section: 'Preferences', fact: 'Prefers TypeScript over JavaScript' },
    { section: 'Preferences', fact: 'Uses VS Code as primary editor' },
    { section: 'People', fact: 'Colleague: Alex (works on backend)' },
    { section: 'Projects', fact: 'memory-system: Local memory for AI agents' },
  ];

  let added = 0;
  for (const { section, fact } of facts) {
    const wasAdded = await memory.addFact(section, fact, true); // skipDuplicates=true
    if (wasAdded) added++;
  }
  console.log(`   Added ${added} new facts to MEMORY.md (${facts.length - added} already existed)`);

  // Read long-term memory
  console.log('\n3. Reading long-term memory...');
  const ltm = await memory.getLongTermMemory();
  console.log('   MEMORY.md contents:');
  console.log('   ' + '-'.repeat(40));
  console.log(ltm.split('\n').map((l) => '   ' + l).join('\n'));

  // Add daily notes (these are timestamped, so duplicates are expected behavior)
  console.log('\n4. Adding daily notes...');
  const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS
  await memory.addDailyNote(`Demo run at ${timestamp}`);
  await memory.addDecision(`Demo decision at ${timestamp}`);
  await memory.addDailyNote(`Demo idea at ${timestamp}`, 'Ideas');
  console.log("   Added 3 timestamped entries to today's notes");

  // Read today's notes
  console.log("\n5. Reading today's notes...");
  const today = await memory.getTodayNotes();
  console.log("   Today's notes:");
  console.log('   ' + '-'.repeat(40));
  console.log(today.split('\n').map((l) => '   ' + l).join('\n'));

  // Start a session
  console.log('\n6. Starting a session...');
  const sessionId = await memory.startSession();
  console.log(`   Session ID: ${sessionId}`);

  // Add some messages
  console.log('\n7. Adding messages to session...');
  await memory.addUserMessage('Hello! Can you help me understand memory systems?');
  await memory.addAssistantMessage(
    'Of course! Memory systems in AI agents typically have multiple tiers...'
  );
  await memory.addUserMessage('What are the different tiers?');
  await memory.addAssistantMessage(
    '1. Short-term (session transcripts)\n2. Episodic (daily notes)\n3. Long-term (curated facts)'
  );
  console.log('   Added 4 messages');

  // Get current token count
  console.log('\n8. Token usage...');
  console.log(`   Current tokens: ${memory.getCurrentTokens()}`);
  console.log(`   Needs compaction: ${memory.needsCompaction()}`);

  // Generate system context
  console.log('\n9. Generating system context...');
  const context = await memory.getSystemContext();
  console.log('   System context preview (first 500 chars):');
  console.log('   ' + '-'.repeat(40));
  console.log(
    context
      .slice(0, 500)
      .split('\n')
      .map((l) => '   ' + l)
      .join('\n')
  );
  if (context.length > 500) {
    console.log('   ...[truncated]');
  }

  // Search memory
  console.log('\n10. Searching memory...');
  const results = await memory.search('TypeScript');
  console.log(`    Found ${results.length} matches for "TypeScript":`);
  for (const result of results) {
    console.log(`    - ${result.content.slice(0, 60)}...`);
  }

  // List sessions
  console.log('\n11. Listing all sessions...');
  const sessions = await memory.listSessions();
  console.log(`    Total sessions: ${sessions.length}`);
  for (const session of sessions.slice(0, 3)) {
    console.log(`    - ${session.sessionId.slice(0, 8)}... (${session.entryCount} entries)`);
  }

  // Cleanup
  freeEncoder();

  console.log('\n' + '='.repeat(60));
  console.log('Demo complete!');
  console.log('='.repeat(60));
  console.log(`\nFiles created in: ${memory.getStoragePath()}`);
  console.log('  - MEMORY.md (long-term memory)');
  console.log('  - memory/*.md (daily notes)');
  console.log('  - agents/demo-agent/sessions/*.jsonl (transcripts)');
  console.log('\nTip: Run with --reset to start fresh');
}

main().catch(console.error);
