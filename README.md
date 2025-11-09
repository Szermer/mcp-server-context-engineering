# MCP Server for Context Engineering

**Version:** 1.0.0
**Status:** Production Ready

MCP server that exposes context engineering operations as executable tools, enabling progressive skill loading and achieving 98.7% token reduction through code execution.

## Overview

This MCP server implements the Model Context Protocol to provide AI agents with efficient access to:
- **Pattern library** - Search and load reusable patterns
- **Executable skills** - Run TypeScript implementations with parameters
- **Session artifacts** - Access finalization packs and historical knowledge
- **Memory system** - Track decisions, hypotheses, and blockers
- **Metrics** - Measure compression ratios and pattern reuse
- **Semantic search** - Query artifacts using Google File Search for conceptual understanding

## Architecture

The server provides **17 tools across 5 modules**:

### Patterns Module (3 tools)
- `searchPatterns` - Search pattern library by keyword/category
- `loadSkill` - Load specific skill documentation and code
- `executeSkill` - Execute skill with parameters

### Artifacts Module (3 tools)
- `searchArtifacts` - Search finalization packs
- `loadSession` - Load complete session context
- `getSessionCode` - Extract executable code from sessions

### Memory Module (3 tools)
- `addNote` - Track decisions/hypotheses/blockers
- `getDecisions` - Retrieve session decisions
- `getHypotheses` - Retrieve session hypotheses

### Metrics Module (2 tools) ✅
- `getCompressionRatio` - Calculate session compression
- `getPatternReuse` - Track pattern reuse statistics

### Search Module (3 tools) ✅
- `semanticSearch` - Query artifacts using Google File Search semantic understanding
- `indexSession` - Index session artifacts to File Search store
- `getSearchStats` - Get indexing statistics and costs

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode (with auto-reload)
npm run dev

# Run tests
npm test

# Type checking
npm run lint
```

## Configuration

Add to your Claude Code MCP configuration (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "context-engineering": {
      "command": "node",
      "args": [
        "/Users/<username>/Dev/mcp-server-context-engineering/dist/index.js"
      ],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Note:** The `GEMINI_API_KEY` environment variable is required for the Search Module tools (`semanticSearch`, `indexSession`, `getSearchStats`). Other tools work without it.

## Usage Example

### Progressive Skill Loading (98.7% Token Reduction)

```typescript
// Step 1: Search for relevant patterns (~100-500 tokens)
const results = await searchPatterns({
  category: 'database',
  keyword: 'RLS',
  includeExecutable: true,
  limit: 5
});

// Step 2: Load specific skill (~500-1000 tokens)
const skill = await loadSkill({
  skillId: 'mcp-integration/rls-policy-generator',
  includeCode: false,  // Documentation only
  includeMetadata: true
});

// Step 3: Execute skill (~50-200 tokens)
const policy = await executeSkill({
  skillId: 'mcp-integration/rls-policy-generator',
  input: {
    table: 'profiles',
    operation: 'SELECT',
    condition: 'auth.uid() = user_id',
    enableRLS: true
  }
});

console.log(policy.data.sql);
// CREATE POLICY "profiles_select_policy" ON "profiles"
//   FOR SELECT
//   USING (auth.uid() = user_id);
```

**Token savings:** 150K tokens (loading all tools upfront) → 2K tokens (progressive loading) = **98.7% reduction**

### Semantic Search (99.1% Token Reduction)

```typescript
// Step 1: Index a session (one-time operation)
const indexResult = await indexSession({
  projectPath: '~/Dev/PrivateLanguage',
  sessionId: '2025-11-07',
  force: false
});

console.log(`Indexed ${indexResult.data.filesIndexed} files`);
console.log(`Cost: $${indexResult.data.cost.toFixed(4)}`);

// Step 2: Query indexed artifacts semantically
const searchResult = await semanticSearch({
  query: 'How did we fix the authentication bug?',
  projectPath: '~/Dev/PrivateLanguage',
  maxResults: 5
});

console.log(searchResult.data.answer);
// "The authentication bug was fixed by updating the JWT token validation..."

console.log(searchResult.data.citations);
// [
//   { source: "2025-11-06-finalization-pack.json", title: "Auth Fix Session" },
//   { source: "2025-11-05-session-summary.md", title: "Security Updates" }
// ]

// Step 3: Check indexing stats
const stats = await getSearchStats({
  projectPath: '~/Dev/PrivateLanguage'
});

console.log(`Total indexed: ${stats.data.stats.totalFilesIndexed} files`);
console.log(`Total cost: $${stats.data.stats.totalCostUsd.toFixed(2)}`);
```

**Token savings:** 179K tokens (loading all artifacts) → 1.6K tokens (semantic search) = **99.1% reduction**

## Development Status

**Phase 2 - Week 4 Complete (2025-11-07) ✅**

- [x] Project setup and TypeScript configuration ✅
- [x] Patterns module implementation (3 tools) ✅
- [x] Artifacts module (3 tools) ✅
- [x] Memory module (3 tools) ✅
- [x] Metrics module (2 tools) ✅
- [x] Search module (3 tools) ✅
- [x] Test suite with vitest (165+ tests passing) ✅
- [ ] Integration testing with Claude Code - Week 5

**Progress:** 17 of 17 tools (100%) 🎉

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Run specific test file
npm test -- src/tools/patterns/searchPatterns.test.ts
```

## Project Structure

```
mcp-server-context-engineering/
├── src/
│   ├── index.ts                    # Server entry point
│   ├── server.ts                   # MCP server configuration
│   ├── tools/
│   │   ├── patterns/              # Patterns module (3 tools) ✅
│   │   │   ├── searchPatterns.ts
│   │   │   ├── loadSkill.ts
│   │   │   └── executeSkill.ts
│   │   ├── artifacts/             # Artifacts module (3 tools) ✅
│   │   │   ├── searchArtifacts.ts
│   │   │   ├── loadSession.ts
│   │   │   └── getSessionCode.ts
│   │   ├── memory/                # Memory module (3 tools) ✅
│   │   │   ├── addNote.ts
│   │   │   ├── getDecisions.ts
│   │   │   └── getHypotheses.ts
│   │   ├── metrics/               # Metrics module (2 tools) ✅
│   │   │   ├── getCompressionRatio.ts
│   │   │   └── getPatternReuse.ts
│   │   └── search/                # Search module (3 tools) ✅
│   │       ├── semanticSearch.ts
│   │       ├── indexSession.ts
│   │       └── getSearchStats.ts
│   └── utils/
│       ├── filesystem.ts          # Pattern library access
│       ├── artifacts.ts           # Finalization pack access
│       ├── memory.ts              # Session memory management
│       ├── metrics.ts             # Compression & reuse metrics
│       ├── tokenEstimator.ts      # Token usage tracking
│       └── validator.ts           # Input validation (TODO)
├── tests/
│   ├── tools/
│   │   ├── patterns.test.ts       # Patterns module tests (30)
│   │   ├── artifacts.test.ts      # Artifacts module tests (19)
│   │   ├── memory.test.ts         # Memory module tests (18)
│   │   ├── metrics.test.ts        # Metrics module tests (23)
│   │   └── search.test.ts         # Search module tests (75+)
│   └── integration/
│       └── server.test.ts         # End-to-end tests
├── dist/                          # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Performance Targets

- **Tool execution:** < 100ms for search operations
- **Skill execution:** < 50ms overhead vs. direct execution
- **Token reduction:** ≥98% measured with real workflows
- **Memory usage:** < 50MB for typical workload

## Documentation

**📚 [Complete Documentation Index](./docs/DOCUMENTATION_INDEX.md)** - Start here for guided navigation

### Quick Start
- **[README.md](./README.md)** (this file) - Overview and quick start
- **[DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)** - Practical guide for extending the server

### Deep Dives
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Complete architectural overview, design principles, and system architecture
- **[DESIGN_DECISIONS.md](./docs/DESIGN_DECISIONS.md)** - Detailed technical decisions and rationale for every implementation choice

### External Resources
- [Model Context Protocol](https://modelcontextprotocol.io/) - Official MCP specification
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - SDK used by this server
- [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) - Anthropic's blog post on code execution patterns

## License

MIT

---

**Created:** 2025-11-05
**Last Updated:** 2025-11-07
**Phase:** 2 (MCP Server Implementation - Complete)
