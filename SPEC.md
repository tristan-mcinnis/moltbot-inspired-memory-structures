# Memory System Specification

## Vision

Give AI agents persistent, local memory that survives across sessions - without cloud dependencies or API costs for storage.

## Problem Statement

LLM agents have no memory between sessions. Each conversation starts from scratch. Users repeat context, agents forget preferences, and there's no continuity of experience.

Existing solutions either:
- Rely on cloud storage (privacy concerns, API costs)
- Use vector databases (complexity overhead)
- Require custom infrastructure (friction)

## Goals

1. **Persistence**: Facts and context survive across sessions
2. **Simplicity**: Plain markdown files - human-readable, git-friendly
3. **Local-first**: All data stays on disk, no cloud required
4. **Agent-agnostic**: Works with any LLM (Claude, OpenAI, local models)
5. **Cost-effective**: Use cheap models (DeepSeek) for compaction, not main model

## Non-Goals

- Semantic/vector search (keep it simple - grep works fine)
- Cloud sync or multi-device (out of scope)
- Encryption at rest (user's responsibility)
- Automatic fact extraction from conversation (agent decides what to store)

---

## Architecture

### Storage Structure

```
~/.memory-test/
├── MEMORY.md              # Long-term facts (curated, permanent)
├── memory/
│   ├── 2026-01-29.md      # Daily notes (ephemeral, timestamped)
│   └── 2026-01-30.md
└── agents/
    └── {agent-id}/
        ├── sessions.json   # Session metadata index
        └── sessions/
            └── {uuid}.jsonl  # Conversation transcripts
```

### Three Memory Layers

| Layer | File | Purpose | Lifespan |
|-------|------|---------|----------|
| **Long-term** | `MEMORY.md` | Curated facts about user | Permanent |
| **Daily** | `memory/YYYY-MM-DD.md` | Session notes, decisions, ideas | Days to weeks |
| **Session** | `sessions/{uuid}.jsonl` | Raw conversation transcript | Until compacted |

### Long-Term Memory (MEMORY.md)

Structured sections for different fact types:

```markdown
# Long-Term Memory

## Preferences
- Prefers TypeScript over JavaScript
- Uses VS Code as primary editor

## People
- Wife: Lingzi
- Dog: Max (golden retriever)

## Projects
- memory-test: Exploring local memory for agents

## Facts
```

**Design decisions:**
- Agent explicitly stores facts (not automatic extraction)
- Duplicate detection prevents redundant entries
- Sections are customizable but default to: Preferences, People, Projects, Facts

### Daily Notes (memory/YYYY-MM-DD.md)

Timestamped entries for ephemeral context:

```markdown
# 2026-01-30

## Session Notes
- [09:15] Started working on spec document

## Decisions Made
- [10:30] Chose markdown over SQLite for simplicity

## Ideas
- [11:00] Could add weekly rollup feature

## Tasks
```

**Design decisions:**
- Append-only (never edit, only add)
- Auto-creates file on first write each day
- Yesterday's notes included in context (recency matters)

### Session Transcripts (JSONL)

Append-only conversation log:

```jsonl
{"id":"uuid","type":"message","role":"user","content":"Hello","timestamp":"...","tokenCount":5}
{"id":"uuid","type":"message","role":"assistant","content":"Hi!","timestamp":"...","tokenCount":3}
{"id":"uuid","type":"compaction","content":"[Summary of removed entries]","metadata":{"removedCount":10}}
```

**Entry types:**
- `message`: User or assistant message
- `tool_call`: Tool invocation
- `tool_result`: Tool response
- `compaction`: Summary replacing older entries

---

## Components

### MemoryManager (Orchestrator)

Central coordinator that combines all layers:

```typescript
const memory = new MemoryManager({ agentId: 'claude-code' });
await memory.init();

// Store facts
await memory.addFact('Preferences', 'Likes dark mode');

// Add notes
await memory.addDailyNote('Started new project');
await memory.addDecision('Using PostgreSQL');

// Get context for LLM
const context = await memory.getSystemContext();
// Returns: Long-term memory + Today's notes + Yesterday's notes
```

### LongTermMemory

Handles `MEMORY.md` operations:
- Parse sections from markdown
- Add facts with duplicate detection
- Search across all facts

### DailyNotes

Handles `memory/YYYY-MM-DD.md`:
- Auto-create daily file
- Timestamped entries
- Section-based organization
- Search across all dates

### SessionStore / Transcript

Handles conversation persistence:
- Create/resume sessions
- Append entries (JSONL format)
- Track token counts
- Support compaction

---

## CLI Interface

For use by Claude Code or other CLI agents:

```bash
# Remember facts
npm run cli -- remember Preferences "Prefers tabs over spaces"
npm run cli -- remember People "Dog: Max, a golden retriever"

# Add notes
npm run cli -- note "Started working on authentication"
npm run cli -- decide "Using JWT for auth tokens"
npm run cli -- idea "Could add OAuth support later"

# Recall
npm run cli -- recall           # Show MEMORY.md
npm run cli -- today            # Show today's notes
npm run cli -- search "auth"    # Search all memory

# Context
npm run cli -- context          # Full context for prompts
npm run cli -- time             # Current time (Shanghai)
```

---

## Compaction Strategy

When session transcripts grow too large, older entries are summarized:

```
                    ┌─────────────────────────────────────┐
                    │          Context Window             │
                    │                                     │
 ┌──────────────────┼─────────────────────────────────────┤
 │ OLD ENTRIES      │ COMPACTION    │ RECENT ENTRIES     │
 │ (to summarize)   │ (summary)     │ (keep as-is)       │
 └──────────────────┴───────────────┴────────────────────┘
```

**Thresholds (configurable):**
- `contextWindow`: 100,000 tokens (model limit)
- `reserveTokens`: 4,000 (for response)
- `softThresholdTokens`: 10,000 (trigger flush to daily notes)
- `keepRecentTokens`: 20,000 (don't compact recent context)

**Process:**
1. When approaching soft threshold, flush important context to daily notes
2. When exceeding hard threshold, summarize older entries via DeepSeek
3. Replace old entries with compaction summary
4. Continue conversation with reduced token count

---

## Agent Integration

### Interactive Agent (demo)

The `npm run agent` command runs an interactive agent with tools:

```typescript
const TOOLS = [
  {
    name: 'store_fact',
    description: 'Store a fact in long-term memory',
    // sections: Preferences, People, Projects, Facts
  },
  {
    name: 'add_note',
    description: "Add a note to today's daily notes",
    // sections: Session Notes, Decisions Made, Ideas, Tasks
  },
  {
    name: 'search_memory',
    description: 'Search across all memory files',
  }
];
```

### Claude Code Integration

Via skill file (`.claude/skills/memory/SKILL.md`):
- Teaches Claude Code the CLI commands
- Triggers on keywords: "remember", "recall", "what do you know", etc.

---

## Configuration

Default config in `types.ts`:

```typescript
export const DEFAULT_CONFIG: MemoryConfig = {
  storagePath: `${process.env.HOME}/.memory-test`,
  contextWindow: 100000,
  reserveTokens: 4000,
  softThresholdTokens: 10000,
  keepRecentTokens: 20000,
};
```

Environment variables:
- `ANTHROPIC_API_KEY`: For interactive agent
- `DEEPSEEK_API_KEY`: For cost-effective compaction

---

## Boundaries

### Always (automatic)
- Create storage directory if missing
- Initialize empty MEMORY.md with default sections
- Create daily note file on first write
- Count tokens on every entry
- Deduplicate facts when `skipDuplicates: true`

### Ask First (requires explicit call)
- Store facts (agent decides what's worth remembering)
- Add notes (agent decides what's notable)
- Trigger compaction (currently manual via `compact()`)
- Search memory

### Never
- Automatically extract facts from conversation (agent must be explicit)
- Delete or edit existing entries (append-only)
- Send data to external services (except DeepSeek for compaction)
- Encrypt/decrypt data (user's responsibility)

---

## Known Limitations / Future Work

### Current Limitations

1. **No automatic context loading**: Agent must call `recall`/`today` at session start
2. **Timezone hardcoded**: `time` command shows Shanghai time only
3. **Search is literal**: No fuzzy matching or semantic search
4. **Session resumption untested**: `resumeSession()` exists but not exposed via CLI
5. **No data cleanup**: Old daily notes accumulate indefinitely
6. **Single agent assumption**: CLI uses hardcoded `agentId: 'claude-code'`

### Potential Enhancements

- [ ] Weekly/monthly rollup of daily notes
- [ ] Configurable timezone
- [ ] Semantic search via embeddings (optional)
- [ ] Auto-prune old daily notes after N days
- [ ] Multi-agent support with shared/private memory
- [ ] Export/import for backup
- [ ] Hook system for pre/post memory operations

---

## Inspiration

Based on [moltbot](https://github.com/moltbot/moltbot) - a similar approach to local agent memory using markdown files.

Key differences from moltbot:
- TypeScript instead of Python
- JSONL transcripts instead of single file
- Token-aware compaction
- Claude Code skill integration
