# Moltbot-Inspired Memory System

A local, markdown-based memory system for AI agents. Inspired by [moltbot](https://github.com/moltbot/moltbot).

LLM agents forget everything between sessions. This gives them persistent memory without cloud dependencies or API costs for storage.

## Quick Start

**Copy the skill** into your Claude Code project:

```bash
cp -r .claude/skills/memory /path/to/your/project/.claude/skills/
cd /path/to/your/project/.claude/skills/memory
npm install
```

**Start using it:**

```bash
npm run cli -- remember People "My name is Claude"
npm run cli -- recall
```

## What's Included

The skill lives in `.claude/skills/memory/` and contains everything needed:
- Full TypeScript source code
- CLI for remembering/recalling facts
- Self-contained (no dependencies on root project)

## Features

- **Plain markdown files** - Human-readable, git-friendly
- **Local-first** - No cloud, no API costs for storage
- **Three-tier memory** - Long-term facts, daily notes, session transcripts
- **Works with any LLM** - Claude, OpenAI, local models

## Storage

All data is stored in `~/.memory-test/`:
- `MEMORY.md` - Long-term facts (permanent)
- `memory/YYYY-MM-DD.md` - Daily notes (ephemeral)
- `agents/{agent-id}/sessions/` - Session transcripts

## Documentation

- **Skill Usage**: See `.claude/skills/memory/README.md`
- **Architecture**: See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## How It Works

Once installed, Claude Code will automatically:
- Remember facts when you mention personal info
- Recall context when starting new sessions
- Store decisions, ideas, and notes in daily logs

Trigger phrases:
- "Remember that I..."
- "What do you know about me?"
- "What did we talk about?"

## License

MIT
