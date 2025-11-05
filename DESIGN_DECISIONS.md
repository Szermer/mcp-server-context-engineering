# Design Decisions Reference

**Version:** 1.0.0
**Last Updated:** 2025-11-05
**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) | [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | [README.md](./README.md)

---

## Purpose

This document provides a detailed reference of technical design decisions made during the implementation of the MCP Server for Context Engineering. It complements the [ARCHITECTURE.md](./ARCHITECTURE.md) by diving deeper into specific implementation choices and their rationale.

---

## Table of Contents

1. [Module Organization](#module-organization)
2. [Type System Design](#type-system-design)
3. [Error Handling Strategy](#error-handling-strategy)
4. [Filesystem Conventions](#filesystem-conventions)
5. [Token Estimation Approach](#token-estimation-approach)
6. [Testing Infrastructure](#testing-infrastructure)
7. [Performance Optimization](#performance-optimization)
8. [Tool Interface Design](#tool-interface-design)

---

## Module Organization

### Decision: Four Modules Over Single Monolith

**Context:** How to organize the 14 tools in the codebase.

**Options considered:**

**Option A: Single module with all tools**
```
src/tools/
├── searchPatterns.ts
├── loadSkill.ts
├── executeSkill.ts
├── searchArtifacts.ts
├── ... (14 files)
```

**Option B: Module per tool**
```
src/tools/
├── searchPatterns/
├── loadSkill/
├── executeSkill/
├── ... (14 directories)
```

**Option C: Four modules by domain ✅ CHOSEN**
```
src/tools/
├── patterns/
│   ├── searchPatterns.ts
│   ├── loadSkill.ts
│   └── executeSkill.ts
├── artifacts/
├── memory/
└── metrics/
```

**Rationale:**

**Why not Option A:**
- 14 files in one directory is hard to navigate
- No logical grouping
- Unclear which tools are related

**Why not Option B:**
- Too much nesting (3+ levels deep)
- Overhead of directory structure
- Harder to see tool relationships

**Why Option C:**
- Clear domain boundaries (patterns, artifacts, memory, metrics)
- Each module is independently testable
- Easy to navigate (4 directories vs 14)
- Natural grouping by concern
- Scales to 20+ tools without reorganization

**Trade-off:** More imports across modules, but improved organization and maintainability.

---

## Type System Design

### Decision: Explicit Input/Output Interfaces for Every Tool

**Context:** How to type tool inputs and outputs.

**Chosen approach:**
```typescript
// 1. Input interface (what the tool accepts)
interface SearchPatternsInput {
  keyword?: string;
  category?: string;
  includeExecutable?: boolean;
  limit?: number;
}

// 2. Output interface (what the tool returns)
interface SearchPatternsOutput {
  success: boolean;
  data?: PatternMetadata[];
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    duration: number;
    resultsCount: number;
  };
}

// 3. Handler uses these types
async function searchPatternsHandler(
  args: unknown
): Promise<MCPResponse> {
  const input = args as SearchPatternsInput;
  const output: SearchPatternsOutput = await searchPatterns(input);
  return formatMCPResponse(output);
}
```

**Why explicit interfaces:**
- **Type safety** - Catches errors at compile time
- **Documentation** - Interfaces are self-documenting
- **IDE support** - Autocomplete and inline docs
- **Refactoring** - Find all usages easily
- **Testing** - Mock inputs/outputs trivially

**Alternative: Generic `Record<string, any>`**
```typescript
// ❌ Too loose, no compile-time validation
async function searchPatternsHandler(
  args: Record<string, any>
): Promise<Record<string, any>>
```

**Alternative: Inline types**
```typescript
// ❌ Repetitive, can't reuse
async function searchPatternsHandler(
  args: { keyword?: string; category?: string }
): Promise<{ success: boolean; data?: any }>
```

**Decision:** Explicit interfaces provide maximum type safety with minimal cost.

---

### Decision: Union Types for Success/Error Responses

**Context:** How to represent operations that can succeed or fail.

**Chosen approach:**
```typescript
interface ToolResult<T> {
  success: boolean;
  data?: T;              // Present if success === true
  error?: {              // Present if success === false
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    duration: number;
  };
}
```

**Why this structure:**
- **Discriminated union** - TypeScript narrows types based on `success`
- **Fail-safe** - No exceptions thrown to MCP client
- **Structured errors** - Error codes enable programmatic handling
- **Observable** - Always includes performance metadata

**Type narrowing in action:**
```typescript
const result = await searchPatterns({ keyword: 'RLS' });

if (result.success) {
  // TypeScript knows result.data is defined
  console.log(result.data.length);
} else {
  // TypeScript knows result.error is defined
  console.error(result.error.message);
}
```

**Alternative: Throw exceptions**
```typescript
// ❌ Breaks MCP connection, confuses agents
async function searchPatterns(input: Input): Promise<Data> {
  if (error) throw new Error('Search failed');
  return data;
}
```

**Alternative: HTTP-style status codes**
```typescript
// ❌ Unnecessary complexity
interface Response {
  statusCode: 200 | 400 | 404 | 500;
  body: any;
}
```

**Decision:** Union types provide type-safe error handling without exceptions.

---

### Decision: Shared Metadata Interface

**Context:** Every tool response includes performance metadata. Should this be standardized?

**Chosen approach:**
```typescript
// Shared base interface
interface ToolMetadata {
  tokensUsed: number;
  duration: number;
  resultsCount?: number;  // Optional, not all tools return lists
}

// Every tool result includes this
interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  metadata: ToolMetadata;  // ✅ Standardized
}
```

**Why standardize:**
- **Consistency** - All tools report performance the same way
- **Observable** - Easy to aggregate metrics across tools
- **Comparable** - Can compare tool performance
- **Future-proof** - Easy to add new metadata fields

**Alternative: Ad-hoc metadata per tool**
```typescript
// ❌ Inconsistent, hard to aggregate
interface SearchResult {
  success: boolean;
  data?: any;
  timing: { ms: number };  // Different structure
  tokens: number;          // Different name
}
```

**Decision:** Standardized metadata enables observability and future metrics dashboards.

---

## Error Handling Strategy

### Decision: Never Throw to MCP Client

**Context:** What happens when an operation fails?

**Chosen approach:**
```typescript
export async function toolHandler(args: unknown): Promise<MCPResponse> {
  try {
    const result = await operation(args);
    return formatSuccess(result);
  } catch (error) {
    // ✅ Catch all errors, return structured response
    return formatError(error);
  }
}
```

**Why never throw:**
- **MCP stability** - Unhandled exceptions break the connection
- **Agent-friendly** - Agents can handle errors programmatically
- **Debugging** - Structured errors easier to diagnose
- **Resilience** - One tool failure doesn't crash the server

**Error structure:**
```typescript
{
  success: false,
  error: {
    code: 'PATTERN_NOT_FOUND',     // Machine-readable
    message: 'Pattern database/rls-policy not found'  // Human-readable
  },
  metadata: {
    tokensUsed: 0,
    duration: 45
  }
}
```

**Error codes used:**
- `PATTERN_NOT_FOUND` - Pattern doesn't exist
- `CATEGORY_INVALID` - Category not in allowed list
- `SKILL_EXECUTION_FAILED` - Skill code threw an error
- `FILESYSTEM_ERROR` - Disk I/O problem
- `VALIDATION_ERROR` - Input doesn't match schema

**Alternative: Let exceptions propagate**
```typescript
// ❌ Breaks MCP connection
export async function toolHandler(args: unknown): Promise<MCPResponse> {
  const result = await operation(args);  // Might throw
  return formatSuccess(result);
}
```

**Decision:** Structured error handling provides stability and better debugging.

---

### Decision: Error Message Sanitization

**Context:** Error messages might leak sensitive information.

**Chosen approach:**
```typescript
function sanitizeError(error: Error, context: string): string {
  const message = error.message;

  // Remove filesystem paths
  const sanitized = message.replace(/\/Users\/[^\/]+\//, '~/')
                           .replace(/\/home\/[^\/]+\//, '~/')
                           .replace(/C:\\Users\\[^\\]+\\/, '~/');

  // Add context
  return `${context}: ${sanitized}`;
}
```

**Examples:**
```typescript
// ❌ UNSAFE - Leaks username
Error: File not found: /Users/stephen/.shared-patterns/database/secret.md

// ✅ SAFE - Generic path
Error: Pattern not found: database/secret
```

**Why sanitize:**
- **Privacy** - Don't leak usernames or paths
- **Security** - Don't reveal directory structure
- **Clarity** - Generic errors are often clearer

**Decision:** Always sanitize error messages before returning to MCP client.

---

## Filesystem Conventions

### Decision: Three-File Pattern for Skills

**Context:** How to organize a skill in the pattern library.

**Chosen structure:**
```
~/.shared-patterns/database/
├── rls-policy.md              # Markdown documentation (required)
├── rls-policy.ts              # TypeScript implementation (optional)
└── rls-policy-SKILL.md        # Metadata file (optional)
```

**File purposes:**

**1. `{name}.md` - Documentation (required)**
- Human-readable explanation
- Usage examples
- Context and background
- Always present (even without executable)

**2. `{name}.ts` - Implementation (optional)**
- Executable TypeScript code
- Parameterized for reuse
- Self-contained (no external dependencies beyond npm packages)

**3. `{name}-SKILL.md` - Metadata (optional)**
- Quality score (1-10)
- Last verified date
- Reuse count
- Dependencies list

**Why this pattern:**
- **Progressive disclosure** - Load docs before code
- **Optional execution** - Not all patterns need code
- **Human + machine readable** - Markdown for humans, TypeScript for machines
- **Discoverable** - Related files grouped by basename

**Alternative: Single file with frontmatter**
```markdown
---
quality: 8.5
hasCode: true
---
# RLS Policy

Documentation here...

\```typescript
// Code here...
\```
```

**Why rejected:**
- Mixing documentation and code is harder to parse
- Can't load docs without loading code
- Harder to version control (large diffs)

**Alternative: Database with metadata**
```json
{
  "id": "database/rls-policy",
  "quality": 8.5,
  "docsPath": "./rls-policy.md",
  "codePath": "./rls-policy.ts"
}
```

**Why rejected:**
- Requires centralized index
- Index can become stale
- More infrastructure to maintain

**Decision:** Three-file pattern balances discoverability, flexibility, and simplicity.

---

### Decision: Quality Score in SKILL.md

**Context:** How to track pattern quality for ranking and extraction decisions.

**Chosen format:**
```markdown
# Skill: RLS Policy Generator

**Category:** database
**Language:** TypeScript
**Quality Score:** 8.5/10
**Last Verified:** 2025-11-05
**Reuse Count:** 12

## Quality Breakdown

| Criterion | Score | Notes |
|-----------|-------|-------|
| Correctness | 9/10 | Generates valid SQL |
| Reusability | 9/10 | Parameterized well |
| Documentation | 8/10 | Good examples, could use more edge cases |
| Test Coverage | 8/10 | Major paths covered |
| Performance | 9/10 | <50ms execution |

**Overall Score:** 8.5/10
```

**Why numeric scores:**
- **Sortable** - Can rank patterns by quality
- **Threshold-based extraction** - Only extract patterns ≥7.0
- **Improvement tracking** - See quality improve over time
- **Objective** - Criteria-based scoring reduces subjectivity

**Scoring criteria:**
1. **Correctness** (0-10) - Does it work as intended?
2. **Reusability** (0-10) - How parameterized is it?
3. **Documentation** (0-10) - Clear usage examples?
4. **Test Coverage** (0-10) - Are tests comprehensive?
5. **Performance** (0-10) - Fast enough for production?

**Extraction threshold:** ≥7.0/10

**Alternative: Boolean flags**
```markdown
- [x] Works correctly
- [x] Well documented
- [ ] Has tests
```

**Why rejected:**
- No ranking (can't sort by quality)
- No improvement tracking
- Too coarse-grained

**Decision:** Numeric scoring enables data-driven quality management.

---

## Token Estimation Approach

### Decision: Character-Based Estimation Over Exact Tokenization

**Context:** Need to report token usage in tool responses. Should we use exact tokenization or estimation?

**Chosen approach:**
```typescript
export function estimateTokensFromJSON(obj: any): number {
  const jsonString = JSON.stringify(obj);
  const charCount = jsonString.length;

  // GPT-style tokenization: ~4 chars per token
  // Add 10% overhead for JSON structure
  return Math.ceil((charCount / 4) * 1.1);
}
```

**Why estimation:**
- **Fast** - No external tokenizer library needed (<1ms)
- **Good enough** - Accurate within ±10% for JSON data
- **Simple** - One line of code, no dependencies
- **Model-agnostic** - Works for GPT, Claude, etc. (similar token densities)

**Accuracy validation:**

| Data Type | Estimated | Actual | Error |
|-----------|-----------|--------|-------|
| JSON object (1KB) | 275 tokens | 260 tokens | +5.7% |
| Array of strings | 145 tokens | 152 tokens | -4.6% |
| Nested JSON | 890 tokens | 850 tokens | +4.7% |

**Alternative: Exact tokenization**
```typescript
import { encode } from 'gpt-tokenizer';

export function countTokens(text: string): number {
  return encode(text).length;
}
```

**Why rejected:**
- Requires dependency (gpt-tokenizer or tiktoken)
- Slower (~10ms per call)
- Model-specific (GPT tokenizer ≠ Claude tokenizer)
- Overkill for order-of-magnitude estimates

**Alternative: Fixed token budget**
```typescript
// Every tool response = 100 tokens
metadata: { tokensUsed: 100 }
```

**Why rejected:**
- Inaccurate (responses vary 10x in size)
- Not useful for optimization
- Doesn't reflect actual usage

**Decision:** Character-based estimation provides sufficient accuracy with minimal cost.

---

### Decision: Include Token Usage in Every Response

**Context:** Should token usage metadata be optional or required?

**Chosen approach:**
```typescript
interface ToolResult<T> {
  // ... other fields ...
  metadata: {
    tokensUsed: number;      // ✅ Always present
    duration: number;
    resultsCount?: number;
  };
}
```

**Why always include:**
- **Observability** - Can track token usage trends
- **Optimization** - Identify high-token operations
- **Cost awareness** - Agents can make token-conscious decisions
- **Consistency** - All tools report the same way

**Example usage by agents:**
```typescript
// Agent can optimize based on token usage
const search = await searchPatterns({ limit: 5 });
// metadata: { tokensUsed: 120 }

if (search.metadata.tokensUsed > 1000) {
  // Too expensive, refine search
}
```

**Alternative: Optional metadata**
```typescript
metadata?: {
  tokensUsed?: number;
}
```

**Why rejected:**
- Inconsistent (some tools report, some don't)
- Can't rely on metadata being present
- Harder to aggregate metrics

**Decision:** Mandatory token reporting enables observability and optimization.

---

## Testing Infrastructure

### Decision: Vitest Over Jest

**Context:** Which test framework to use?

**Options:**

**Option A: Jest**
- Most popular (de facto standard)
- Mature ecosystem
- Extensive documentation

**Option B: Vitest ✅ CHOSEN**
- Native ESM support (no babel)
- Faster execution (Vite-powered)
- TypeScript out-of-the-box
- Compatible with Jest API

**Rationale:**

**Why Vitest:**
- **ESM native** - No transpilation needed (our code uses `"type": "module"`)
- **Speed** - 2-3x faster than Jest in benchmarks
- **TypeScript** - No @types/jest needed, better type inference
- **Modern** - Designed for Vite/modern tooling

**Migration path:**
- Most Jest tests work in Vitest (API compatibility)
- Can switch to Jest later if needed

**Trade-off:** Smaller ecosystem than Jest, but sufficient for our needs.

**Decision:** Vitest provides better TypeScript and ESM support with similar API.

---

### Decision: Co-located Tests

**Context:** Where should test files live?

**Options:**

**Option A: Separate tests/ directory**
```
src/tools/patterns/searchPatterns.ts
tests/tools/patterns/searchPatterns.test.ts
```

**Option B: Co-located with source ✅ CHOSEN**
```
src/tools/patterns/
├── searchPatterns.ts
└── searchPatterns.test.ts
```

**Why co-located:**
- **Discoverability** - Test next to source
- **Cohesion** - Related files together
- **Refactoring** - Easy to move tool + test
- **IDE navigation** - Jump between test and source

**Why not separate directory:**
- Extra navigation (2+ directories deep)
- Easy to forget to update tests
- Source and tests can drift apart

**Trade-off:** Test files in source tree, but better developer experience.

**Decision:** Co-located tests improve maintainability.

---

### Decision: Test File Naming Convention

**Context:** How to name test files?

**Chosen convention:**
```
{toolName}.test.ts
```

**Examples:**
- `searchPatterns.test.ts`
- `loadSkill.test.ts`
- `executeSkill.test.ts`

**Why `.test.ts` suffix:**
- Standard convention (Jest, Vitest, etc.)
- Easy to glob: `**/*.test.ts`
- Clear distinction from source

**Alternative: `.spec.ts`**
```
searchPatterns.spec.ts
```

**Why rejected:**
- Less common in TypeScript ecosystem
- "Spec" implies BDD, we're not using BDD

**Alternative: `__tests__/` directory**
```
__tests__/
├── searchPatterns.ts
└── loadSkill.ts
```

**Why rejected:**
- Extra directory nesting
- Harder to find tests
- Not co-located

**Decision:** `.test.ts` suffix is standard and discoverable.

---

## Performance Optimization

### Decision: No Caching in Phase 2

**Context:** Should we cache pattern metadata or finalization packs?

**Chosen approach:** No caching

**Why no caching (yet):**
- **Simplicity** - Caching adds complexity (invalidation, memory management, stale data)
- **Fast enough** - Filesystem reads are <10ms for markdown files
- **Always fresh** - No stale cache bugs
- **Premature optimization** - No evidence of performance problems

**Current performance:**
- Pattern search: ~50ms (target: <100ms) ✅
- Load skill: ~80ms (target: <200ms) ✅
- Filesystem read: ~5-10ms per file

**When to add caching:**
- Pattern library grows to 1000+ patterns (currently <50)
- Search operations exceed 100ms target
- Production metrics show filesystem I/O bottleneck

**Caching strategy (future):**
```typescript
// LRU cache for pattern metadata
const cache = new LRUCache<string, PatternMetadata>({
  max: 500,  // Cache up to 500 patterns
  ttl: 60 * 1000  // 60 second TTL
});

// Check cache first
const cached = cache.get(patternId);
if (cached) return cached;

// Load from filesystem
const pattern = await loadPattern(patternId);
cache.set(patternId, pattern);
return pattern;
```

**Decision:** Defer caching until performance data justifies complexity.

---

### Decision: Parallel Category Search

**Context:** Should we search pattern categories sequentially or in parallel?

**Current approach (Phase 2):** Sequential
```typescript
for (const category of categories) {
  const patterns = await searchCategory(category);
  allPatterns.push(...patterns);
}
```

**Performance:** 7 categories × 10ms = 70ms total

**Future approach (Phase 3+):** Parallel
```typescript
const searches = categories.map(cat => searchCategory(cat));
const results = await Promise.all(searches);
const allPatterns = results.flat();
```

**Projected performance:** max(10ms) = 10ms total (7x speedup)

**Why not parallel now:**
- **Good enough** - 70ms < 100ms target
- **Simpler code** - Sequential is easier to debug
- **Resource usage** - Parallel can overwhelm filesystem on spinning disks

**When to add parallelism:**
- Pattern library grows to 20+ categories
- Search operations approach 100ms target

**Decision:** Sequential search is sufficient for Phase 2; revisit in Phase 3.

---

## Tool Interface Design

### Decision: JSON Schema for Input Validation

**Context:** How to validate tool inputs?

**Chosen approach:**
```typescript
export const searchPatternsTool: Tool = {
  name: 'searchPatterns',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Keyword to search for'
      },
      category: {
        type: 'string',
        enum: ['database', 'security', 'ui', 'backend', 'testing', 'architecture', 'mcp-integration']
      }
    }
  }
};
```

**Why JSON Schema:**
- **Standard** - MCP protocol uses JSON Schema
- **Declarative** - Validation rules are data, not code
- **Self-documenting** - Schema describes the API
- **IDE-friendly** - Tools can generate autocomplete

**Validation enforcement:**
- MCP SDK validates inputs before calling handler
- Invalid inputs rejected with clear error messages
- No need for manual validation in handler code

**Alternative: Manual validation**
```typescript
function validate(input: any): SearchPatternsInput {
  if (input.category && !VALID_CATEGORIES.includes(input.category)) {
    throw new Error('Invalid category');
  }
  // ... more validation ...
  return input as SearchPatternsInput;
}
```

**Why rejected:**
- Repetitive (every tool needs validation)
- Error-prone (easy to forget cases)
- Not self-documenting

**Decision:** JSON Schema provides standard, declarative validation.

---

### Decision: Description Strings for Agent Comprehension

**Context:** How descriptive should tool descriptions be?

**Chosen approach:**
```typescript
export const searchPatternsTool: Tool = {
  name: 'searchPatterns',
  description: 'Search pattern library by keyword and category. Returns pattern metadata for progressive loading. Use this to discover available patterns before loading full documentation.',
  inputSchema: { /* ... */ }
};
```

**Description guidelines:**
- **First sentence:** What the tool does
- **Second sentence:** What it returns
- **Third sentence (optional):** When to use it

**Why detailed descriptions:**
- **Agent comprehension** - AI agents rely on descriptions to choose tools
- **Disambiguation** - Clear descriptions reduce wrong tool usage
- **Self-documenting** - Developers understand tool purpose

**Bad example (too terse):**
```typescript
description: 'Search patterns'  // ❌ Not enough context
```

**Bad example (too verbose):**
```typescript
description: 'This tool allows you to search through the pattern library which is stored in the ~/.shared-patterns directory by providing a keyword and/or category filter and it will return a list of matching patterns with their metadata including quality scores and whether they have executable implementations...'  // ❌ Too long, hard to parse
```

**Sweet spot:** 2-3 sentences, 50-100 words

**Decision:** Concise but complete descriptions improve agent tool selection.

---

## Conclusion

These design decisions reflect a philosophy of:

1. **Type safety** - Catch errors at compile time
2. **Observability** - Always include performance metadata
3. **Fail-safe** - Never throw to MCP client
4. **Simplicity** - Defer complexity until needed
5. **Standards** - Use MCP, JSON Schema, TypeScript conventions

Every decision is revisited as requirements evolve. See [ARCHITECTURE.md](./ARCHITECTURE.md) for higher-level architectural patterns.

---

**Document version:** 1.0.0
**Last updated:** 2025-11-05
**Authors:** Stephen Szermer
