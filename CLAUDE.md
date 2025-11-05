# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an **MCP (Model Context Protocol) server** that exposes context engineering operations as executable tools. It enables AI agents to progressively load skills and patterns, achieving **98.7% token reduction** compared to loading all context upfront.

**Primary Technologies:**
- **Runtime**: Node.js 18+ with ES Modules
- **Language**: TypeScript (strict mode)
- **Framework**: @modelcontextprotocol/sdk v0.5.0
- **Testing**: Vitest with 90 passing tests
- **Transport**: stdio (standard input/output)

**Documentation:**
- **[CLAUDE.md](./CLAUDE.md)** (this file) - Quick reference for Claude Code
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Step-by-step guide for extending the server
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep dive into design principles and system architecture
- **[DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)** - Rationale for every technical decision
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Navigation hub for all documentation

## Common Development Commands

### Development
```bash
# Build TypeScript to dist/
npm run build

# Development mode with auto-reload (tsx watch)
npm run dev

# Type checking without emitting files
npm run lint

# Clean build artifacts
npm run clean
```

### Testing
```bash
# Run all tests (90 tests across 4 modules)
npm test

# Run with coverage reports
npm run test:coverage

# Watch mode for test-driven development
npm test -- --watch

# Run specific test file
npm test -- tests/tools/patterns.test.ts
npm test -- tests/tools/artifacts.test.ts
npm test -- tests/tools/memory.test.ts
npm test -- tests/tools/metrics.test.ts

# Run single test by name
npm test -- -t "searchPatterns"
```

### Running the Server
```bash
# Production (after build)
node dist/index.js

# Development with auto-reload
npm run dev
```

The server communicates via stdio and should be configured in Claude Code's MCP settings (`~/.config/claude/claude_desktop_config.json`).

## Core Architectural Principles

Before working with the code, understand these foundational principles (see [ARCHITECTURE.md](./ARCHITECTURE.md) for details):

### 1. Progressive Disclosure
Load tool definitions and data on-demand, not upfront. The Patterns module implements a three-stage workflow:
- **Search** (`searchPatterns`) → metadata only (~100-500 tokens)
- **Load** (`loadSkill`) → full documentation (~500-1000 tokens)
- **Execute** (`executeSkill`) → code execution (~50-200 tokens)

This pattern achieves 98.7% token reduction vs. loading everything upfront.

### 2. Fail-Safe Error Handling
**Never throw exceptions to the MCP client.** All errors are caught and returned as structured responses:
```typescript
{
  success: false,
  error: { code: 'PATTERN_NOT_FOUND', message: 'Pattern database/rls-policy not found' },
  metadata: { tokensUsed: 0, duration: 45 }
}
```

Unhandled exceptions break the MCP connection—always use try/catch in tool handlers.

### 3. Observable Performance
Every response includes:
- `tokensUsed` - Estimated token consumption (4 chars = 1 token heuristic)
- `duration` - Execution time in milliseconds
- `resultsCount` - Number of results (for search operations)

This enables agents to make token-conscious decisions.

### 4. Filesystem as the API
Patterns and artifacts live in the filesystem, not a database:
```
~/.shared-patterns/          # Pattern library
  category/
    skill-name.md           # Documentation (required)
    skill-name-SKILL.md     # Metadata (optional)
    skill-name.ts           # Implementation (optional)

<project>/.agent-artifacts/  # Session history
  YYYY-MM-DD_session-name/
    finalization-pack.json
    finalization-pack.md

<project>/.agent-memory/     # Runtime context
  current-session.md
```

Agents can use standard filesystem tools (ls, grep, find) naturally.

### 5. Type Safety First
TypeScript strict mode with zero `any` types. Every tool has explicit input/output interfaces validated via JSON Schema at the MCP protocol layer.

## High-Level Architecture

### Four-Module Tool System

The server provides **14 MCP tools** organized into 4 functional modules:

#### 1. Patterns Module (3 tools)
Progressive skill loading workflow:
- `searchPatterns` - Search pattern library by keyword/category (~100-500 tokens)
- `loadSkill` - Load full skill documentation (~500-1000 tokens)
- `executeSkill` - Execute skill implementation (~50-200 tokens)

**Key insight:** Agents search → evaluate → load → execute, only loading what they need.

#### 2. Artifacts Module (3 tools)
Access to finalization packs (historical session knowledge):
- `searchArtifacts` - Full-text search across all projects' finalization packs
- `loadSession` - Load complete session context from a specific date
- `getSessionCode` - Extract executable code snippets from sessions

#### 3. Memory Module (3 tools)
Session runtime context management:
- `addNote` - Track decisions/hypotheses/blockers during work
- `getDecisions` - Retrieve all decisions from current session
- `getHypotheses` - Retrieve all hypotheses for testing

#### 4. Metrics Module (2 tools)
Context engineering performance measurement:
- `getCompressionRatio` - Calculate token reduction from finalization
- `getPatternReuse` - Track how often patterns are reused

### Code Organization

```
src/
├── index.ts                    # Entry point (stdio transport setup)
├── server.ts                   # MCP server config (tool registration)
├── tools/
│   ├── patterns/              # Progressive skill loading
│   │   ├── searchPatterns.ts  # Search + metadata only
│   │   ├── loadSkill.ts       # Load full documentation
│   │   └── executeSkill.ts    # Dynamic import + execution
│   ├── artifacts/             # Historical knowledge
│   │   ├── searchArtifacts.ts # Full-text search
│   │   ├── loadSession.ts     # Load session context
│   │   └── getSessionCode.ts  # Extract code snippets
│   ├── memory/                # Session runtime
│   │   ├── addNote.ts         # Write notes
│   │   ├── getDecisions.ts    # Read decisions
│   │   └── getHypotheses.ts   # Read hypotheses
│   └── metrics/               # Performance tracking
│       ├── getCompressionRatio.ts
│       └── getPatternReuse.ts
└── utils/
    ├── filesystem.ts          # Pattern library access (~/.shared-patterns/)
    ├── artifacts.ts           # Finalization pack parsing
    ├── memory.ts              # Session memory management
    ├── metrics.ts             # Compression calculations
    └── tokenEstimator.ts      # Token usage estimation
```

### Tool Implementation Pattern

Every tool follows this standardized structure (see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md#adding-a-new-tool) for full guide):

```typescript
// 1. Tool definition (MCP schema with JSON Schema validation)
export const myToolTool: Tool = {
  name: 'myTool',
  description: 'Clear description (2-3 sentences). What does it do? What does it return?',
  inputSchema: {
    type: 'object',
    properties: {
      requiredParam: { type: 'string', description: 'Parameter description' }
    },
    required: ['requiredParam']
  }
};

// 2. Input/Output interfaces (explicit typing)
interface MyToolInput {
  requiredParam: string;
  optionalParam?: string;
}

interface MyToolOutput {
  success: boolean;
  data?: ResultType;
  error?: { code: string; message: string };
  metadata: { tokensUsed: number; duration: number };
}

// 3. MCP handler (protocol wrapper)
export async function myToolHandler(args: unknown): Promise<MCPResponse> {
  const startTime = Date.now();
  try {
    const result = await myTool(args as MyToolInput);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    // Always catch and return structured error
    return formatError(error, Date.now() - startTime);
  }
}

// 4. Core logic (business logic, fully testable)
async function myTool(input: MyToolInput): Promise<MyToolOutput> {
  const startTime = Date.now();
  // ... implementation ...
  const tokensUsed = estimateTokensFromJSON(data);
  return { success: true, data, metadata: { tokensUsed, duration: Date.now() - startTime } };
}
```

**Key conventions:**
- Tool names end with `Tool` (e.g., `searchPatternsTool`)
- Handler names end with `Handler` (e.g., `searchPatternsHandler`)
- Core logic function matches tool name (e.g., `searchPatterns()`)
- Always include token estimation and timing
- Never throw to MCP client—always return structured responses

Tools are registered in `src/server.ts` (import, add to tools array, add handler case).

## Adding a New Tool

**Quick workflow** (see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md#adding-a-new-tool) for detailed guide):

1. **Choose module** - patterns/, artifacts/, memory/, or metrics/
2. **Create tool file** - `src/tools/{module}/{toolName}.ts`
3. **Implement pattern** - Follow structure above (Tool definition → Interfaces → Handler → Core logic)
4. **Register in server** - Edit `src/server.ts`:
   ```typescript
   import { myToolHandler, myToolTool } from './tools/{module}/{toolName}.js';

   const tools: Tool[] = [
     // ... existing tools ...
     myToolTool,  // ← Add here
   ];

   switch (name) {
     // ... existing cases ...
     case 'myTool':
       return await myToolHandler(args);
   }
   ```
5. **Write tests** - Create/update `tests/tools/{module}.test.ts`
6. **Verify** - Run `npm run lint && npm test && npm run build`

**Common pitfalls to avoid:**
- Forgetting to register tool in `src/server.ts` (won't be available!)
- Using `console.log()` instead of `console.error()` (breaks MCP stdio)
- Not sanitizing filesystem paths in error messages (leaks usernames)
- Forgetting to estimate token usage (metadata.tokensUsed should never be hardcoded)
- Not testing error cases (only testing happy path)

## Key Architectural Decisions

### Progressive Skill Loading (98.7% Token Reduction)

The Patterns module implements a **three-stage progressive disclosure pattern**:

1. **Search** (`searchPatterns`) - Returns only metadata (name, category, quality score, description). Agent can evaluate relevance with minimal tokens.

2. **Load** (`loadSkill`) - Loads full SKILL.md documentation on demand. Agent understands interface and examples before committing to execution.

3. **Execute** (`executeSkill`) - Dynamically imports TypeScript implementation and runs it. Only the function call, parameters, and result consume context.

**Comparison:**
- Old approach: Load all 50+ skills upfront = ~150K tokens
- New approach: Search (100) + Load (500) + Execute (200) = ~2K tokens
- **Savings: 98.7% reduction**

### Three-File Skill Pattern

Executable skills use a standardized structure in `~/.shared-patterns/` (see [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md#decision-three-file-pattern-for-skills) for rationale):

```
category/
├── skill-name.md         # Pattern documentation (required)
├── skill-name-SKILL.md   # Skill metadata & interface (optional)
└── skill-name.ts         # TypeScript implementation (optional)
```

**File purposes:**
- **`.md`** - Human-readable explanation, usage examples, context
- **`-SKILL.md`** - Metadata (quality score, reuse count, dependencies), input/output interface
- **`.ts`** - Executable TypeScript code with `export async function execute(input) { ... }`

**Quality scores** (in `-SKILL.md`):
```markdown
**Quality Score:** 8.5/10

| Criterion | Score | Notes |
|-----------|-------|-------|
| Correctness | 9/10 | Generates valid output |
| Reusability | 9/10 | Well parameterized |
| Documentation | 8/10 | Good examples |
| Test Coverage | 8/10 | Major paths covered |
| Performance | 9/10 | <50ms execution |
```

**Extraction threshold:** Skills with quality ≥7.0/10 are candidates for pattern library extraction during finalization.

**Why this pattern:**
- Progressive disclosure (load docs before code)
- Optional execution (not all patterns need code)
- Human + machine readable (Markdown for humans, TypeScript for machines)
- Discoverable (related files grouped by basename)

### File System Conventions

- **Shared patterns**: `~/.shared-patterns/` (user home directory)
- **Project artifacts**: `<project>/.agent-artifacts/YYYY-MM-DD/finalization-pack.md`
- **Session memory**: `<project>/.agent-memory/YYYY-MM-DD/notes.md`

Tools access these locations via `utils/filesystem.ts`, `utils/artifacts.ts`, and `utils/memory.ts`.

### TypeScript Configuration

- **Module system**: ES Modules with Node16 resolution (`.js` imports required)
- **Strict mode**: All type checking flags enabled
- **Target**: ES2022 (modern Node.js features)
- **Build output**: `dist/` directory with source maps and declarations

The shebang (`#!/usr/bin/env node`) in `src/index.ts` enables direct execution after build.

### Testing Strategy

Tests are organized to mirror the tool structure:

- `tests/tools/patterns.test.ts` - 30 tests for Patterns module
- `tests/tools/artifacts.test.ts` - 19 tests for Artifacts module
- `tests/tools/memory.test.ts` - 18 tests for Memory module
- `tests/tools/metrics.test.ts` - 23 tests for Metrics module
- `tests/integration/server.test.ts` - End-to-end server tests (planned)

**Test structure pattern:**
```typescript
describe('toolName', () => {
  describe('happy path', () => {
    it('should do X when Y', async () => { });
  });

  describe('edge cases', () => {
    it('should handle empty results', async () => { });
  });

  describe('error handling', () => {
    it('should return error for invalid input', async () => { });
  });

  describe('performance', () => {
    it('should complete in <100ms', async () => { });
  });
});
```

**Why Vitest over Jest:**
- Native ESM support (no babel/transpilation)
- Faster execution (2-3x speed improvement)
- Better TypeScript support out-of-the-box
- Compatible with Jest API (easy migration)

## Error Codes Reference

Use these standardized error codes (see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md#error-handling-patterns) for full guide):

**Filesystem errors:**
- `FILE_NOT_FOUND` - File doesn't exist
- `DIRECTORY_NOT_FOUND` - Directory doesn't exist
- `FILE_READ_ERROR` - Failed to read file
- `FILE_WRITE_ERROR` - Failed to write file

**Validation errors:**
- `INVALID_INPUT` - Input doesn't match expected format
- `MISSING_REQUIRED_PARAM` - Required parameter not provided
- `INVALID_CATEGORY` - Category not in allowed list

**Pattern/Skill errors:**
- `PATTERN_NOT_FOUND` - Pattern doesn't exist
- `SKILL_NOT_FOUND` - Skill doesn't exist
- `SKILL_EXECUTION_FAILED` - Skill code threw an error

**Artifact errors:**
- `ARTIFACT_NOT_FOUND` - Finalization pack not found
- `SESSION_NOT_FOUND` - Session doesn't exist

**Generic:**
- `OPERATION_FAILED` - Generic operation failure
- `UNKNOWN_ERROR` - Unexpected error

**Error message sanitization:** Always remove filesystem paths that contain usernames:
```typescript
// ❌ BAD - Leaks username
Error: File not found: /Users/stephen/.shared-patterns/database/secret.md

// ✅ GOOD - Generic path
Error: Pattern not found: database/secret
```

## Important Implementation Notes

### Dynamic Import for Skill Execution

`executeSkill.ts` uses dynamic `import()` to load skill implementations:

```typescript
const skillModule = await import(skillPath);
const result = await skillModule.execute(input);
```

This allows skills to be loaded on-demand without bundling them with the server. Skills must export an `execute` function.

### Error Handling Pattern

All tool handlers wrap execution in try/catch and return MCP-compliant error responses:

```typescript
try {
  // Tool logic
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
} catch (error) {
  return {
    content: [{ type: 'text', text: `Error: ${error.message}` }],
    isError: true
  };
}
```

This is handled centrally in `src/server.ts` for consistency.

### Token Estimation

`utils/tokenEstimator.ts` provides rough token counts (4 chars = 1 token heuristic). This is used for:
- Calculating compression ratios
- Estimating pattern size before loading
- Performance metrics

Not meant to be exact—good enough for optimization decisions.

### File System Safety

All filesystem operations use `fs/promises` (async) and handle missing directories/files gracefully. Patterns/artifacts may not exist on fresh installations.

## Testing Philosophy

- **Unit tests** for each tool's core logic
- **Integration tests** for tool handlers (input validation, error cases)
- **No mocking** of filesystem—tests use real file operations against test fixtures (when implemented)
- **Fast execution** - entire suite runs in < 1 second

Run tests before committing. Use `npm run lint` to catch type errors.

## Development Workflow

1. **Make changes** to tools or utilities
2. **Run tests** - `npm test` (should be fast)
3. **Type check** - `npm run lint`
4. **Build** - `npm run build`
5. **Test manually** - `npm run dev` and interact via MCP client

For rapid iteration on a single tool:
```bash
npm test -- --watch tests/tools/patterns.test.ts
```

## Performance Targets

- **Tool execution**: < 100ms for search operations
- **Skill execution**: < 50ms overhead vs. direct execution
- **Token reduction**: ≥98% for progressive loading workflows
- **Memory usage**: < 50MB for typical workload

Measure these with `getCompressionRatio` and `getPatternReuse` tools.

## Documentation Hub

This project has extensive documentation organized by depth and audience. See **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** for complete navigation.

### Quick Reference (5-15 minutes)
- **[CLAUDE.md](./CLAUDE.md)** (this file) - Quick reference for Claude Code
- **[README.md](./README.md)** - Project overview, installation, usage examples

### Developer Guides (30-60 minutes)
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Step-by-step guide for extending the server
  - Getting started, project structure
  - Adding a new tool (complete walkthrough with code templates)
  - Testing strategies, debugging, common pitfalls

### Architecture Deep Dives (1-3 hours)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architectural overview
  - Six core principles, system architecture, module design
  - Performance, security, testing, future extensibility
- **[DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)** - Rationale for every technical decision
  - TypeScript vs JavaScript, stdio vs HTTP, filesystem vs database
  - Type system, error handling, token estimation, testing infrastructure

### Strategic Context (1-2 hours)
- **[ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md)** - Why we built this
- **[Phase 2 Kickoff](../ClaudeDev/docs/PHASE_2_MCP_SERVER_KICKOFF.md)** - 4-week implementation plan

### External Resources
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://modelcontextprotocol.io/docs/sdk)
- [Code execution with MCP (Anthropic blog)](https://www.anthropic.com/engineering/code-execution-with-mcp)

## Package Scripts Reference

```json
{
  "build": "tsc",                          // Compile TypeScript
  "dev": "tsx watch src/index.ts",         // Auto-reload on changes
  "test": "vitest",                        // Run tests
  "test:coverage": "vitest --coverage",    // With coverage report
  "lint": "tsc --noEmit",                  // Type checking only
  "clean": "rm -rf dist"                   // Remove build artifacts
}
```

---

**Status:** Phase 2 - Week 3 Complete (2025-11-05)
**Progress:** 14 of 14 tools implemented (100%) ✅
**Next:** Week 4 - Integration testing with Claude Code
