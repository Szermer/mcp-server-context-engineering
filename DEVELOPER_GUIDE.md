# Developer Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-05
**For:** Developers extending or contributing to the MCP server

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Adding a New Tool](#adding-a-new-tool)
4. [Testing Your Tool](#testing-your-tool)
5. [Working with the Filesystem](#working-with-the-filesystem)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Debugging](#debugging)
8. [Common Pitfalls](#common-pitfalls)
9. [Code Review Checklist](#code-review-checklist)
10. [Publishing Changes](#publishing-changes)

---

## Getting Started

### Prerequisites

```bash
# Node.js 18 or higher
node --version  # Should be 18.x or higher

# npm (comes with Node)
npm --version
```

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-server-context-engineering.git
cd mcp-server-context-engineering

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Start in development mode (auto-reload)
npm run dev
```

### Development Workflow

```bash
# 1. Make changes to src/
vim src/tools/patterns/newTool.ts

# 2. Run tests (watch mode)
npm test -- --watch

# 3. Type-check
npm run lint

# 4. Build
npm run build

# 5. Test with Claude Code
# (Add to claude_desktop_config.json, restart Claude Code)
```

---

## Project Structure

```
mcp-server-context-engineering/
├── src/
│   ├── index.ts                   # Entry point
│   ├── server.ts                  # MCP server setup
│   ├── tools/                     # Tool implementations
│   │   ├── patterns/              # Patterns module (3 tools)
│   │   │   ├── searchPatterns.ts
│   │   │   ├── loadSkill.ts
│   │   │   └── executeSkill.ts
│   │   ├── artifacts/             # Artifacts module (3 tools)
│   │   ├── memory/                # Memory module (3 tools)
│   │   └── metrics/               # Metrics module (2 tools)
│   └── utils/                     # Shared utilities
│       ├── filesystem.ts          # Pattern library access
│       ├── artifacts.ts           # Finalization pack access
│       ├── memory.ts              # Session memory
│       ├── metrics.ts             # Performance tracking
│       └── tokenEstimator.ts      # Token usage estimation
├── tests/
│   └── tools/
│       ├── patterns.test.ts
│       ├── artifacts.test.ts
│       ├── memory.test.ts
│       └── metrics.test.ts
├── dist/                          # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

**Key files:**
- **src/server.ts** - Register tools here
- **src/tools/{module}/{tool}.ts** - Tool implementations
- **src/utils/** - Shared utilities (filesystem, token estimation)

---

## Adding a New Tool

### Step 1: Choose a Module

Tools are organized into modules:
- **patterns/** - Pattern library operations
- **artifacts/** - Finalization pack operations
- **memory/** - Session memory operations
- **metrics/** - Performance tracking

If your tool doesn't fit existing modules, consider creating a new module.

### Step 2: Create Tool File

Create `src/tools/{module}/{toolName}.ts`:

```typescript
/**
 * {toolName} Tool
 *
 * Brief description of what this tool does.
 * Mention token usage if relevant.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { /* utilities */ } from '../../utils/filesystem.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const myToolTool: Tool = {
  name: 'myTool',
  description: 'Clear, concise description (2-3 sentences). What does it do? What does it return?',
  inputSchema: {
    type: 'object',
    properties: {
      requiredParam: {
        type: 'string',
        description: 'Description of this parameter'
      },
      optionalParam: {
        type: 'string',
        description: 'Optional parameter',
      }
    },
    required: ['requiredParam']
  }
};

/**
 * Input interface
 */
interface MyToolInput {
  requiredParam: string;
  optionalParam?: string;
}

/**
 * Output interface
 */
interface MyToolOutput {
  success: boolean;
  data?: any;  // Replace 'any' with specific type
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    duration: number;
  };
}

/**
 * Handler for MCP protocol
 */
export async function myToolHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as MyToolInput;
    const result = await myTool(input);

    const responseText = JSON.stringify(result, null, 2);

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorResult: MyToolOutput = {
      success: false,
      error: {
        code: 'TOOL_ERROR',
        message: errorMessage
      },
      metadata: {
        tokensUsed: 0,
        duration
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResult, null, 2)
        }
      ]
    };
  }
}

/**
 * Core tool logic
 */
async function myTool(input: MyToolInput): Promise<MyToolOutput> {
  const startTime = Date.now();

  try {
    // TODO: Implement tool logic here

    const data = { /* result data */ };
    const tokensUsed = estimateTokensFromJSON(data);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data,
      metadata: {
        tokensUsed,
        duration
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'TOOL_ERROR',
        message: errorMessage
      },
      metadata: {
        tokensUsed: 0,
        duration
      }
    };
  }
}
```

### Step 3: Register Tool in Server

Edit `src/server.ts`:

```typescript
// 1. Import tool
import { myToolHandler, myToolTool } from './tools/{module}/{toolName}.js';

// 2. Add to tools array
const tools: Tool[] = [
  // ... existing tools ...
  myToolTool,  // ← Add here
];

// 3. Add handler case
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ... existing cases ...

      case 'myTool':
        return await myToolHandler(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // ... error handling ...
  }
});
```

### Step 4: Write Tests

Create `tests/tools/{module}.test.ts` (or add to existing):

```typescript
import { describe, it, expect } from 'vitest';
import { myToolHandler } from '../../src/tools/{module}/{toolName}';

describe('myTool', () => {
  describe('happy path', () => {
    it('should return success with valid input', async () => {
      const result = await myToolHandler({
        requiredParam: 'test'
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing required param', async () => {
      const result = await myToolHandler({});

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should complete in <100ms', async () => {
      const result = await myToolHandler({
        requiredParam: 'test'
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.metadata.duration).toBeLessThan(100);
    });
  });
});
```

### Step 5: Build and Test

```bash
# Type-check
npm run lint

# Run tests
npm test

# Build
npm run build

# Test with Claude Code
# (Restart Claude Code to pick up changes)
```

---

## Testing Your Tool

### Unit Testing with Vitest

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tools/patterns/searchPatterns.test.ts

# Run in watch mode
npm test -- --watch

# Run with coverage
npm run test:coverage
```

### Test Structure

```typescript
describe('toolName', () => {
  // Happy path tests
  describe('happy path', () => {
    it('should do X when Y', async () => { });
    it('should do Z when W', async () => { });
  });

  // Edge cases
  describe('edge cases', () => {
    it('should handle empty input', async () => { });
    it('should handle missing optional param', async () => { });
  });

  // Error handling
  describe('error handling', () => {
    it('should return error for invalid input', async () => { });
    it('should handle filesystem errors', async () => { });
  });

  // Performance
  describe('performance', () => {
    it('should complete in <100ms', async () => { });
  });
});
```

### Mocking Filesystem Operations

```typescript
import { vi } from 'vitest';
import * as fs from 'fs/promises';

// Mock filesystem
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn()
}));

// In test
it('should handle missing file', async () => {
  vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

  const result = await myToolHandler({ path: '/missing' });
  const parsed = JSON.parse(result.content[0].text);

  expect(parsed.success).toBe(false);
  expect(parsed.error.code).toBe('FILE_NOT_FOUND');
});
```

### Integration Testing

Test complete workflows:

```typescript
describe('complete workflow', () => {
  it('should search, load, and execute pattern', async () => {
    // 1. Search
    const search = await searchPatternsHandler({
      keyword: 'RLS'
    });
    const searchResult = JSON.parse(search.content[0].text);
    expect(searchResult.success).toBe(true);

    // 2. Load
    const load = await loadSkillHandler({
      skillId: searchResult.data[0].id
    });
    const loadResult = JSON.parse(load.content[0].text);
    expect(loadResult.success).toBe(true);

    // 3. Execute
    const execute = await executeSkillHandler({
      skillId: loadResult.data.id,
      input: { table: 'profiles' }
    });
    const executeResult = JSON.parse(execute.content[0].text);
    expect(executeResult.success).toBe(true);
  });
});
```

---

## Working with the Filesystem

### Reading Pattern Files

```typescript
import { getSharedPatternsPath, searchPatternsInCategory } from '../utils/filesystem.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Get patterns directory
const patternsDir = getSharedPatternsPath();
// Returns: /Users/<username>/.shared-patterns

// Search category
const patterns = await searchPatternsInCategory('database', 'RLS', true);
// Returns: Array<PatternMetadata>

// Read specific file
const mdPath = path.join(patternsDir, 'database', 'rls-policy.md');
const content = await fs.readFile(mdPath, 'utf-8');
```

### Safe Filesystem Operations

**Always use these patterns:**

```typescript
// ✅ GOOD - Check if file exists before reading
import { fileExists } from '../utils/filesystem.js';

if (await fileExists(filePath)) {
  const content = await fs.readFile(filePath, 'utf-8');
}

// ✅ GOOD - Use path.join for safety
import * as path from 'path';

const safePath = path.join(baseDir, category, filename);

// ❌ BAD - String concatenation
const unsafePath = `${baseDir}/${userInput}`;  // Path traversal risk!

// ✅ GOOD - Catch filesystem errors
try {
  const content = await fs.readFile(filePath, 'utf-8');
} catch (error) {
  return {
    success: false,
    error: {
      code: 'FILE_READ_ERROR',
      message: 'Failed to read file'  // Don't leak path
    }
  };
}
```

### Working with Artifacts

```typescript
import {
  searchArtifacts,
  loadSession,
  getProjectArtifactsPath
} from '../utils/artifacts.js';

// Search finalization packs
const artifacts = await searchArtifacts({
  keyword: 'authentication',
  project: 'PrivateLanguage'
});

// Load specific session
const session = await loadSession({
  sessionId: '2025-11-05_auth-implementation',
  project: 'PrivateLanguage'
});

// Get artifacts directory
const artifactsDir = getProjectArtifactsPath('/path/to/project');
// Returns: /path/to/project/.agent-artifacts
```

---

## Error Handling Patterns

### Always Return Structured Errors

```typescript
// ✅ GOOD
async function myTool(input: Input): Promise<Output> {
  try {
    // ... operation ...
    return {
      success: true,
      data: result,
      metadata: { tokensUsed, duration }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: error.message
      },
      metadata: { tokensUsed: 0, duration }
    };
  }
}

// ❌ BAD - Don't throw to MCP client
async function myTool(input: Input): Promise<Output> {
  // ... operation ...
  throw new Error('Something went wrong');  // Breaks MCP connection!
}
```

### Error Code Conventions

Use specific error codes:

```typescript
// Filesystem errors
'FILE_NOT_FOUND'
'DIRECTORY_NOT_FOUND'
'FILE_READ_ERROR'
'FILE_WRITE_ERROR'

// Validation errors
'INVALID_INPUT'
'MISSING_REQUIRED_PARAM'
'INVALID_CATEGORY'

// Pattern errors
'PATTERN_NOT_FOUND'
'SKILL_NOT_FOUND'
'SKILL_EXECUTION_FAILED'

// Artifact errors
'ARTIFACT_NOT_FOUND'
'SESSION_NOT_FOUND'

// Generic
'OPERATION_FAILED'
'UNKNOWN_ERROR'
```

### Sanitize Error Messages

```typescript
import * as path from 'path';

function sanitizeErrorMessage(error: Error): string {
  return error.message
    .replace(/\/Users\/[^\/]+\//g, '~/')
    .replace(/\/home\/[^\/]+\//g, '~/')
    .replace(/C:\\Users\\[^\\]+\\/g, '~/');
}
```

---

## Debugging

### Enable Debug Logging

```typescript
// Add to tool handler
export async function myToolHandler(args: unknown) {
  console.error('[DEBUG] myTool called with:', JSON.stringify(args, null, 2));

  try {
    const result = await myTool(args as MyToolInput);
    console.error('[DEBUG] myTool result:', JSON.stringify(result, null, 2));
    return formatSuccess(result);
  } catch (error) {
    console.error('[DEBUG] myTool error:', error);
    return formatError(error);
  }
}
```

**Note:** Use `console.error()` not `console.log()` (stdout is used for MCP protocol)

### Test Tool Locally

```typescript
// Create test script: scripts/test-tool.ts
import { myToolHandler } from '../src/tools/myModule/myTool.js';

async function main() {
  const result = await myToolHandler({
    requiredParam: 'test'
  });

  console.log(JSON.stringify(JSON.parse(result.content[0].text), null, 2));
}

main();
```

```bash
# Run test script
npx tsx scripts/test-tool.ts
```

### Test with Claude Code

1. Build the server:
```bash
npm run build
```

2. Add to `~/.config/claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "context-engineering": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-server-context-engineering/dist/index.js"
      ]
    }
  }
}
```

3. Restart Claude Code

4. Ask Claude to use your tool:
```
Can you search for RLS patterns using the context-engineering MCP server?
```

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update server.ts

**Problem:**
```typescript
// Created new tool file
src/tools/patterns/newTool.ts

// But didn't register it in server.ts
// Tool won't be available!
```

**Solution:** Always update `server.ts` with:
1. Import statement
2. Tool in tools array
3. Handler case in switch

### Pitfall 2: Using console.log Instead of console.error

**Problem:**
```typescript
console.log('Debug message');  // ❌ Breaks MCP protocol (stdout)
```

**Solution:**
```typescript
console.error('Debug message');  // ✅ Uses stderr
```

### Pitfall 3: Not Sanitizing Paths in Errors

**Problem:**
```typescript
throw new Error(`File not found: /Users/stephen/.shared-patterns/...`);
// ❌ Leaks username
```

**Solution:**
```typescript
throw new Error(`Pattern not found: ${category}/${name}`);
// ✅ Generic path
```

### Pitfall 4: Forgetting Token Estimation

**Problem:**
```typescript
return {
  success: true,
  data: result,
  metadata: {
    tokensUsed: 0,  // ❌ Wrong!
    duration
  }
};
```

**Solution:**
```typescript
import { estimateTokensFromJSON } from '../utils/tokenEstimator.js';

const tokensUsed = estimateTokensFromJSON(result);  // ✅ Estimate
return {
  success: true,
  data: result,
  metadata: { tokensUsed, duration }
};
```

### Pitfall 5: Not Testing Error Cases

**Problem:**
```typescript
// Only test happy path
it('should work', async () => { });
```

**Solution:**
```typescript
// Test errors too
describe('error handling', () => {
  it('should handle missing file', async () => { });
  it('should handle invalid input', async () => { });
  it('should handle permission errors', async () => { });
});
```

---

## Code Review Checklist

Before submitting a PR, verify:

- [ ] Tool file created in correct module
- [ ] Tool registered in `server.ts` (import, tools array, handler)
- [ ] Input/output interfaces defined
- [ ] JSON Schema for input validation
- [ ] Error handling (try/catch, return structured errors)
- [ ] Token estimation included
- [ ] Duration tracking included
- [ ] Tests written (happy path, edge cases, errors)
- [ ] Tests pass (`npm test`)
- [ ] Type-check passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Tool description is clear (2-3 sentences)
- [ ] Error messages sanitized (no paths leaked)
- [ ] Documentation updated (if needed)

---

## Publishing Changes

### Step 1: Run All Checks

```bash
# Type-check
npm run lint

# Run tests
npm test

# Build
npm run build
```

### Step 2: Commit

```bash
git add .
git commit -m "feat(patterns): Add newTool for X functionality"
```

**Commit message format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `test` - Adding tests
- `refactor` - Code refactoring

**Scopes:**
- `patterns` - Patterns module
- `artifacts` - Artifacts module
- `memory` - Memory module
- `metrics` - Metrics module
- `utils` - Utilities
- `server` - Server configuration

### Step 3: Push

```bash
git push origin main
```

### Step 4: Update Version (if releasing)

```bash
# Update version in package.json
npm version patch  # or minor, major

# Tag release
git push --tags
```

---

## Getting Help

**Documentation:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - High-level architecture
- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Detailed design rationale
- [README.md](./README.md) - Usage and setup

**Issues:**
- File issues on GitHub: https://github.com/yourusername/mcp-server-context-engineering/issues

**MCP Resources:**
- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP SDK Docs](https://modelcontextprotocol.io/docs/sdk)

---

**Document version:** 1.0.0
**Last updated:** 2025-11-05
**Authors:** Stephen Szermer
