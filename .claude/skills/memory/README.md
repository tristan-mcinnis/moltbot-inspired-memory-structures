# Memory Skill for Claude Code

A self-contained persistent memory system that can be dropped into any project.

## Quick Setup

1. **Copy this skill** into your project:
   ```bash
   cp -r .claude/skills/memory /path/to/your/project/.claude/skills/
   ```

2. **Install dependencies**:
   ```bash
   cd /path/to/your/project/.claude/skills/memory
   npm install
   ```

3. **Set up environment** (optional):
   ```bash
   cp .env.example .env
   # Edit .env if you want to use the interactive agent feature
   ```

4. **Start using it** (run from skill directory):
   ```bash
   cd /path/to/your/project/.claude/skills/memory
   npm run cli -- remember People "Your name is Claude"
   npm run cli -- recall
   ```

   Or create an alias for convenience:
   ```bash
   alias memory="cd /path/to/your/project/.claude/skills/memory && npm run cli --"
   memory remember People "Your name is Claude"
   ```

## Files Structure

```
.claude/skills/memory/
├── SKILL.md          # This file - how Claude uses the skill
├── README.md         # This file - setup instructions
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
├── .env.example      # Environment template
└── src/              # Source code
    ├── cli.ts        # CLI entry point
    ├── index.ts      # Programmatic API
    ├── types.ts      # Type definitions
    ├── config.ts     # Configuration management
    ├── memory/       # Memory layer
    │   ├── MemoryManager.ts
    │   ├── LongTermMemory.ts
    │   └── DailyNotes.ts
    ├── session/      # Session handling
    │   ├── SessionStore.ts
    │   └── Transcript.ts
    └── utils/        # Utilities
        ├── markdown.ts
        └── tokens.ts
```

## Storage Location

Memory is stored in `~/.memory-test/` by default:
- `MEMORY.md` - Long-term facts
- `memory/YYYY-MM-DD.md` - Daily notes
- `agents/{agent-id}/sessions/` - Session transcripts

## Available Commands

```bash
# Long-term memory
npm run cli -- remember <section> "<fact>"
npm run cli -- forget <section> "<fact>"
npm run cli -- recall

# Daily notes
npm run cli -- note "<content>"
npm run cli -- decide "<decision>"
npm run cli -- idea "<idea>"
npm run cli -- today

# Search
npm run cli -- search "<query>"
npm run cli -- context
```

## Sections

When using `remember`, use one of these sections:
- `Preferences` - User preferences (editor, language, style)
- `People` - People the user mentions (colleagues, family)
- `Projects` - Projects being worked on
- `Facts` - Other facts worth remembering

## Customization

Edit `src/config.ts` to change:
- Storage path
- Timezone
- Section names
- Token limits

## Programmatic Usage

```typescript
import { MemoryManager } from './src/index.js';

const memory = new MemoryManager({ agentId: 'my-agent' });
await memory.init();

await memory.addFact('Preferences', 'Likes dark mode');
const context = await memory.getSystemContext();
```

## License

MIT
