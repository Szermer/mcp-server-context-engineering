# MCP Server for Context Engineering

**Version:** 1.0.0
**Status:** Phase 2 - In Development
**ADR:** [ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md)

MCP server that exposes context engineering operations as executable tools, enabling progressive skill loading and achieving 98.7% token reduction through code execution.

## Overview

This MCP server implements the Model Context Protocol to provide AI agents with efficient access to:
- **Pattern library** - Search and load reusable patterns
- **Executable skills** - Run TypeScript implementations with parameters
- **Session artifacts** - Access finalization packs and historical knowledge
- **Memory system** - Track decisions, hypotheses, and blockers
- **Metrics** - Measure compression ratios and pattern reuse

## Architecture

The server provides **14 tools across 4 modules**:

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
      ]
    }
  }
}
```

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

## Development Status

**Phase 2 - Week 3 Complete (2025-11-05) ✅**

- [x] Project setup and TypeScript configuration ✅
- [x] Patterns module implementation (3 tools) ✅
- [x] Artifacts module (3 tools) ✅
- [x] Memory module (3 tools) ✅
- [x] Metrics module (2 tools) ✅
- [x] Test suite with vitest (90 tests passing) ✅
- [ ] Integration testing with Claude Code - Week 4

**Progress:** 14 of 14 tools (100%) 🎉

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
│   │   └── metrics/               # Metrics module (2 tools) ✅
│   │       ├── getCompressionRatio.ts
│   │       └── getPatternReuse.ts
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
│   │   └── metrics.test.ts        # Metrics module tests (23)
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

## Related Documentation

- **[Phase 2 Kickoff](../ClaudeDev/docs/PHASE_2_MCP_SERVER_KICKOFF.md)** - 4-week implementation plan
- **[ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md)** - Architecture decision record
- **[Executable Skills Guide](../ClaudeDev/docs/guides/EXECUTABLE_SKILLS_GUIDE.md)** - How to create executable skills
- **[MCP Architecture](~/.shared-patterns/mcp-integration/ARCHITECTURE.md)** - Three-file pattern design

## License

MIT

---

**Created:** 2025-11-05
**Last Updated:** 2025-11-05
**Phase:** 2 (MCP Server Implementation)
