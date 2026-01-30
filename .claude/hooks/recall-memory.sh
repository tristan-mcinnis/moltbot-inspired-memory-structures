#!/bin/bash
cd /Users/tristan/Documents/Code/memory-test
echo "=== MEMORY CONTEXT ==="
npm run cli -- recall 2>/dev/null
echo ""
echo "=== TODAY'S NOTES ==="
npm run cli -- today 2>/dev/null
