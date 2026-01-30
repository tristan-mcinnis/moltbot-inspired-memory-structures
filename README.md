# Moltbot-Inspired Memory System

A local, markdown-based memory system for AI agents. Inspired by [moltbot](https://github.com/moltbot/moltbot).

## Why?

LLM agents forget everything between sessions. This gives them persistent memory without cloud dependencies or API costs for storage.

**Key features:**
- Plain markdown files (human-readable, git-friendly)
- Local-first (no cloud, no API costs)
- Three-tier architecture (long-term facts, daily notes, session transcripts)
- Works with any LLM (Claude, OpenAI, local models)

## Quick Start

```bash
# Install
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys and timezone

# Run the demo
npm run demo

# Try the CLI
npm run cli -- remember Preferences "Prefers dark mode"
npm run cli -- recall

# Run interactive agent (requires ANTHROPIC_API_KEY)
npm run agent
```

## Project Structure

```
├── docs/
│   └── ARCHITECTURE.md     # Detailed system design
├── examples/
│   ├── demo.ts             # Demo script
│   └── interactive-agent.ts # Chat agent with memory
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── types.ts            # Shared type definitions
│   ├── memory/             # Memory layer
│   │   ├── MemoryManager.ts
│   │   ├── LongTermMemory.ts
│   │   └── DailyNotes.ts
│   ├── session/            # Session handling
│   │   ├── SessionStore.ts
│   │   └── Transcript.ts
│   └── utils/
├── .claude/                # Claude Code integration
└── .env.example            # Environment template
```

## Storage Structure

All data is stored in `~/.memory-test/`:

```
~/.memory-test/
├── MEMORY.md              # Long-term facts (permanent)
├── memory/
│   └── 2026-01-30.md      # Daily notes (ephemeral)
└── agents/
    └── {agent-id}/
        └── sessions/
            └── {uuid}.jsonl  # Conversation transcripts
```

## CLI Commands

```bash
# Long-term memory
npm run cli -- remember <section> "<fact>"   # Store a fact
npm run cli -- recall                        # Show all facts

# Daily notes
npm run cli -- note "<content>"              # Add a note
npm run cli -- decide "<decision>"           # Record a decision
npm run cli -- idea "<idea>"                 # Record an idea
npm run cli -- today                         # Show today's notes

# Search & utilities
npm run cli -- search "<query>"              # Search all memory
npm run cli -- context                       # Full context for LLM
npm run cli -- time                          # Current date/time
```

### Sections for Facts

When using `remember`, use one of these sections:
- `Preferences` - User preferences (editor, language, style)
- `People` - People the user mentions (colleagues, family)
- `Projects` - Projects being worked on
- `Facts` - Other facts worth remembering

Example:
```bash
npm run cli -- remember Preferences "Uses vim keybindings"
npm run cli -- remember People "Manager: Jordan (approves PRs)"
npm run cli -- remember Projects "api-redesign: Migrating to GraphQL"
```

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Required for interactive agent
ANTHROPIC_API_KEY=sk-ant-...

# Optional: for cost-effective compaction (uses DeepSeek instead of Claude)
DEEPSEEK_API_KEY=sk-...

# Optional: timezone for the 'time' command (default: UTC)
MEMORY_TIMEZONE=America/New_York
```

### Custom Storage Path

By default, data is stored in `~/.memory-test/`. To change this, modify `DEFAULT_CONFIG` in `src/memory/types.ts`:

```typescript
export const DEFAULT_CONFIG: MemoryConfig = {
  storagePath: `${process.env.HOME}/.my-custom-path`,
  // ...
};
```

Or pass it programmatically:

```typescript
import { MemoryManager } from 'moltbot-inspired-memory';

const memory = new MemoryManager({
  storagePath: '/path/to/storage',
  agentId: 'my-agent',
});
```

## Claude Code Integration

This project includes a skill for [Claude Code](https://claude.ai/claude-code). The skill teaches Claude how to use the memory CLI.

To use it:
1. Clone this repo
2. Open the project in Claude Code
3. Claude will automatically use the memory commands when appropriate

The skill triggers on phrases like:
- "remember that..."
- "what do you know about me?"
- "what did we talk about?"

## Programmatic Usage

```typescript
import { MemoryManager } from 'moltbot-inspired-memory';

const memory = new MemoryManager({ agentId: 'my-agent' });
await memory.init();

// Store facts
await memory.addFact('Preferences', 'Likes TypeScript');

// Add daily notes
await memory.addDailyNote('Started new project');
await memory.addDecision('Using PostgreSQL for database');

// Get context for LLM prompts
const context = await memory.getSystemContext();
// Returns: long-term memory + today's notes + yesterday's notes

// Search
const results = await memory.search('TypeScript');
```

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed system design.

### Three Memory Layers

| Layer | File | Purpose | Lifespan |
|-------|------|---------|----------|
| Long-term | `MEMORY.md` | Curated facts | Permanent |
| Daily | `memory/YYYY-MM-DD.md` | Session notes | Days/weeks |
| Session | `sessions/*.jsonl` | Conversation log | Until compacted |

### Compaction

When sessions get too long, older messages are summarized (using DeepSeek for cost efficiency) and replaced with a compact summary. This keeps context within LLM token limits.

## Example Memory Files

### MEMORY.md
```markdown
# Long-Term Memory

## Preferences
- Prefers TypeScript over JavaScript
- Uses VS Code with vim keybindings
- Likes dark mode

## People
- Colleague: Alex (backend developer)
- Manager: Jordan (approves PRs on Fridays)

## Projects
- api-redesign: Migrating REST to GraphQL
- mobile-app: React Native rewrite

## Facts
- Works remotely, based in NYC timezone
```

### Daily Notes (memory/2026-01-30.md)
```markdown
# 2026-01-30

## Session Notes
- [09:15] Started working on authentication refactor
- [14:30] Debugged OAuth callback issue

## Decisions Made
- [10:00] Using JWT with 1-hour expiry
- [16:00] Postponing mobile app work until next sprint

## Ideas
- [11:30] Could add rate limiting middleware

## Tasks
- [09:00] Review Alex's PR for user service
```

## Development

```bash
# Build
npm run build

# Run TypeScript directly
npm run dev

# Run demo
npm run demo
npm run demo -- --reset  # Reset and start fresh
```

## License

MIT
