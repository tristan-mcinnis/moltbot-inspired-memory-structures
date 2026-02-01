---
name: memory
description: "Persistent memory system. Use when user asks: remember, recall, what do you know, what did we talk about, last time, earlier, previous session, my birthday, time, date, take notes, or any personal information lookup."
---

# Memory System

You have access to a persistent memory system stored in `~/.memory-test/`. Use it to remember facts about the user and record session notes.

## Setup (First Time Only)

If this skill was just copied into the project, run:
```bash
cd .claude/skills/memory && npm install
```

## Storage Structure

- `MEMORY.md` - Long-term facts (preferences, people, projects)
- `memory/YYYY-MM-DD.md` - Daily notes (timestamped entries)

## Commands

All commands run from the skill directory (`.claude/skills/memory/`):

```bash
cd .claude/skills/memory
npm run cli -- remember People "Fact here"
```

Or from project root with full path:

### Remember a fact
```bash
npm run cli -- remember <section> "<fact>"
```
Sections: `Preferences`, `People`, `Projects`, `Facts`

Example:
```bash
npm run cli -- remember People "Colleague: Alex (backend dev)"
```

### Forget a fact
```bash
npm run cli -- forget <section> "<fact>"
```

Example:
```bash
npm run cli -- forget People "Dog: Max (golden retriever)"
```

### Recall all facts
```bash
npm run cli -- recall
```

### Add a note to today
```bash
npm run cli -- note "<content>"
```

### Record a decision
```bash
npm run cli -- decide "<decision>"
```

### Record an idea
```bash
npm run cli -- idea "<idea>"
```

### Show today's notes
```bash
npm run cli -- today
```

### Search memory
```bash
npm run cli -- search "<query>"
```

### Get current time (Shanghai)
```bash
npm run cli -- time
```

## When to Use

**For time/date questions:**
- Always use `npm run cli -- time` instead of `date` command
- Shows Shanghai timezone

**Proactively remember** when the user mentions:
- Personal info (family, pets, preferences)
- Project decisions
- Technical preferences
- Important dates or events

**Proactively recall** when:
- Starting a new session (check what you know)
- User asks about past conversations
- Context would help the current task

**Correct mistakes** when:
- User says information is wrong (use `forget` then `remember`)

## Examples

User: "I prefer tabs over spaces"
→ Run: `npm run cli -- remember Preferences "Prefers tabs over spaces"`

User: "What do you know about me?"
→ Run: `npm run cli -- recall`

User: "We decided to use PostgreSQL"
→ Run: `npm run cli -- decide "Using PostgreSQL for the database"`

User: "What did we talk about last time?" or "What happened earlier?"
→ Run: `npm run cli -- today` (for recent session notes)

User: "Did I mention anything about X?"
→ Run: `npm run cli -- search "X"`

User: "I don't have a dog named Max"
→ Run: `npm run cli -- forget People "Dog: Max (golden retriever)"`
