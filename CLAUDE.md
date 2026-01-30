## Memory System Active

This project has a persistent memory system. **Always use the memory skill**.

**At session start or when asked about previous conversations:**
```bash
npm run cli -- today    # Check today's notes first
npm run cli -- recall   # Then check long-term memory
```

**When user mentions personal info or asks you to remember:**
```bash
npm run cli -- remember <section> "<fact>"
npm run cli -- note "<what happened>"
```

---

## Project Context

We were helping Tristan explore different ways to do local memory storage for agents.

It's inspired heavily by the Moltbot repository: https://github.com/moltbot/moltbot
