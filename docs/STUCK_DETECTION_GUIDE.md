# Stuck Detection System - User Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-09
**Status:** Production Ready

---

## Overview

The Stuck Detection System helps developers identify when they're stuck during a development session and provides intelligent recovery suggestions based on past solutions.

### Key Features

- **3 Detection Types**: Repeated blockers, no progress, error loops
- **Real-time Analysis**: Sub-3s response time for full analysis
- **Smart Suggestions**: Ranked by relevance, recency, and success rate
- **Cooldown Protection**: Prevents alert spam (max 1 alert per 10 min)
- **Session Integration**: Leverages Qdrant session memory for context

---

## Quick Start

### 1. Prerequisites

Ensure you have an active session:

```bash
/session-start <keyword>
```

### 2. Check if Stuck

At any time during development:

```bash
/check-stuck
```

### 3. Review Suggestions

If stuck, the system will:
1. Identify the stuck pattern
2. Search session memory for solutions
3. Rank and display top 3 suggestions
4. Provide actionable implementation steps

---

## Detection Types

### Type 1: Repeated Blocker

**Trigger:** Same blocker mentioned 3+ times
**Confidence:** Based on repetition count and time span

**Example:**
```
⚠️ Repeated Blocker Detected

Blocker mentioned 4 times over 1h 23m

Evidence:
  [14:23] Can't connect to database
  [14:45] Database connection failing
  [15:12] Database timeout persists
  [15:46] Still blocked on database
```

**How to Track:**
```typescript
mcp__context-engineering__save_session_note({
  type: "blocker",
  content: "Can't connect to database - connection timeout"
})
```

### Type 2: No Progress

**Trigger:** No file changes for 20+ minutes
**Confidence:** Increases with idle time (20m=0.5, 40m=0.75, 60m=1.0)

**Example:**
```
⚠️ No Progress Detected

No file changes for 32 minutes

Evidence:
  Last file modification: 14:45
  Current time: 15:17
  Idle time: 32m
```

**How it Works:**
- Scans project directory recursively
- Tracks modification timestamps
- Ignores `node_modules`, `.git`, `dist`, etc.

### Type 3: Error Loop

**Trigger:** Same error occurring 5+ times
**Confidence:** Based on error repetition count

**Example:**
```
⚠️ Error Loop Detected

Same error occurred 6 times

Evidence:
  [14:23] TypeError: Cannot read property 'id' of undefined
  [14:31] TypeError: Cannot read property 'id' of undefined
  [14:38] TypeError: Cannot read property 'id' of undefined
  [14:45] TypeError: Cannot read property 'id' of undefined
  [14:52] TypeError: Cannot read property 'id' of undefined
  [14:59] TypeError: Cannot read property 'id' of undefined
```

**How it Works:**
- Searches session notes for error keywords
- Groups similar errors by semantic similarity
- Uses Jaccard similarity (70% threshold)

---

## Recovery Suggestions

### Suggestion Structure

```typescript
{
  title: string              // Brief summary
  description: string        // Full context
  source: 'current_session' | 'past_session' | 'pattern_library'
  relevanceScore: number     // 0.0 to 1.0
  implementation: {
    steps: string[]          // Actionable steps
    codeExample?: string     // Code snippet if available
    references: string[]     // Session IDs or timestamps
  }
  metadata: {
    sessionId?: string
    timestamp?: string
    successRate?: number
  }
}
```

### Ranking Algorithm

Composite score = weighted average:
- **Relevance** (50%): Semantic similarity to stuck pattern
- **Recency** (30%): How recent the solution is
- **Success** (20%): Inferred success rate

**Recency Scoring:**
- 0-1 hour: 1.0
- 1-24 hours: 0.7
- 1-7 days: 0.4
- 7+ days: 0.2

### Example Output

```
💡 Recovery Suggestions

1. Check database connection configuration

   The connection timeout error was resolved by updating the
   DATABASE_URL environment variable to include the correct port.

   How to apply:
   • Verify .env file exists
   • Check DATABASE_URL format: postgres://user:pass@host:5432/db
   • Restart development server

   Code:
   ```bash
   echo $DATABASE_URL
   docker-compose restart postgres
   ```

   Source: current_session (15 min ago)
   Relevance: 0.89

2. [Next suggestion...]

3. [Next suggestion...]
```

---

## Cooldown Mechanism

**Purpose:** Prevents alert spam during investigation

**Behavior:**
- Alert triggers when stuck pattern detected
- 10-minute cooldown starts
- Subsequent checks show "Cooldown Active" message
- Manual `/check-stuck` respects cooldown

**Bypass:**
Use manual session search:
```typescript
mcp__context-engineering__session_search({
  query: "database connection solution"
})
```

---

## MCP Tools Reference

### check_stuck_pattern

**Purpose:** Analyze current session for stuck patterns

**Input:**
```typescript
{
  projectPath: string  // Absolute path to project
}
```

**Output:**
```typescript
{
  success: boolean
  data: {
    stuck: boolean
    patterns: StuckPattern[]
    overallConfidence: number
    lastAlertTime: string | null
    cooldownActive: boolean
  }
}
```

**Example:**
```typescript
const result = await mcp__context-engineering__check_stuck_pattern({
  projectPath: "/Users/username/Dev/PrivateLanguage"
})

if (result.data.stuck) {
  console.log(`Detected: ${result.data.patterns.length} patterns`)
  console.log(`Confidence: ${result.data.overallConfidence}`)
}
```

### get_recovery_suggestions

**Purpose:** Generate recovery suggestions for a stuck pattern

**Input:**
```typescript
{
  stuckPattern: StuckPattern
  projectPath: string
  maxSuggestions?: number  // Default: 3
}
```

**Output:**
```typescript
{
  success: boolean
  data: {
    stuckPattern: StuckPattern
    suggestions: RecoverySuggestion[]
    searchDuration: {
      qdrant: number
      googleFS: number
      total: number
    }
  }
}
```

**Example:**
```typescript
const suggestions = await mcp__context-engineering__get_recovery_suggestions({
  stuckPattern: detectedPattern,
  projectPath: "/Users/username/Dev/PrivateLanguage",
  maxSuggestions: 5
})

suggestions.data.suggestions.forEach(s => {
  console.log(`${s.title} (${s.relevanceScore})`)
})
```

---

## Best Practices

### 1. Track Blockers Consistently

❌ **Don't:**
```typescript
// Vague, unhelpful
save_session_note({
  type: "blocker",
  content: "Error"
})
```

✅ **Do:**
```typescript
// Specific, actionable
save_session_note({
  type: "blocker",
  content: "Can't deploy to staging - permission denied on /var/app/deploy.sh. Need to add deploy user to app-admins group."
})
```

### 2. Document Solutions

When you fix a blocker, save the solution:

```typescript
// After fixing the issue
save_session_note({
  type: "decision",
  content: "Fixed deployment by adding deploy user to app-admins group via: sudo usermod -aG app-admins deploy"
})

save_session_note({
  type: "learning",
  content: "Staging environment uses different IAM roles than dev. Always check group membership before deployment."
})
```

### 3. Use /check-stuck Proactively

Don't wait until you're completely blocked:

- After 20+ minutes of no progress
- After encountering same error 3+ times
- When you feel stuck but can't articulate why

### 4. Review Suggestions Carefully

Suggestions are ranked by relevance but may not be perfect:

- Read all 3 suggestions before acting
- Consider context (your situation vs. past situation)
- Adapt solutions to your specific case

---

## Performance Targets

| Metric | Target | Actual (Tested) |
|--------|--------|-----------------|
| Detection latency | <3s | 1.2s avg |
| False positive rate | <10% | TBD |
| Recall | ≥80% | TBD |
| Suggestion latency | <3s | 0.8s avg (Qdrant only) |
| Cooldown period | 10 min | 10 min ✅ |

---

## Troubleshooting

### Error: "No active session"

**Cause:** Session not initialized
**Solution:** Run `/session-start` first

```bash
/session-start my-feature
# Then try again
/check-stuck
```

### No Suggestions Returned

**Possible Causes:**
1. Session too new (<5 minutes, few notes)
2. Stuck pattern too generic
3. No relevant decisions/learnings in session

**Solutions:**
- Continue working and track more notes
- Use manual search: `/session-search <keyword>`
- Check past sessions: `searchArtifacts` MCP tool

### Cooldown Too Aggressive

**Issue:** Can't check again for 10 minutes
**Workaround:** Use session_search manually

```typescript
mcp__context-engineering__session_search({
  query: "your specific problem"
})
```

**Future:** Configurable cooldown per-project

### Detection Not Triggering

**Check:**
1. Are you tracking blockers? (`save_session_note`)
2. Have 20+ minutes passed with no file changes?
3. Are errors being saved to session notes?

**Debug:**
```typescript
// Check session stats
const stats = await mcp__context-engineering__get_session_stats()
console.log(stats.data.notesByType)
```

---

## Roadmap

### v1.0 (Current) ✅
- 3 detection types
- Qdrant-based recovery suggestions
- 10-minute cooldown
- `/check-stuck` command

### v2.0 (Planned)
- Google File Search integration for historical patterns
- Configurable cooldown periods
- Custom detection thresholds
- Automatic stuck detection (background monitoring)
- Pattern library integration
- Success rate tracking

### v3.0 (Future)
- Machine learning-based detection
- Personalized suggestion ranking
- Team-wide stuck pattern analysis
- IDE integration (real-time notifications)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────┐
│                /check-stuck                     │
│              Slash Command                      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│          check_stuck_pattern                    │
│              MCP Tool                           │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│            StuckDetector                        │
│          (src/utils/)                           │
│                                                 │
│  • detectRepeatedBlocker()                     │
│  • detectNoProgress()                          │
│  • detectErrorLoop()                           │
│  • analyze() - Orchestrator                    │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│       SessionCoordinator                        │
│      (Qdrant + OpenAI)                         │
│                                                 │
│  • getNotesByType('blocker')                   │
│  • search(query)                               │
│  • Semantic similarity                         │
└─────────────────────────────────────────────────┘

If stuck detected:
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│     get_recovery_suggestions                    │
│           MCP Tool                              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         RecoveryEngine                          │
│         (src/utils/)                            │
│                                                 │
│  • generateSuggestions()                       │
│  • searchCurrentSession()                      │
│  • rankSuggestions()                           │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│    Top 3 Ranked Suggestions                     │
│    (Relevance + Recency + Success)             │
└─────────────────────────────────────────────────┘
```

### Data Flow

1. **Input:** `/check-stuck` command
2. **Gather:** StuckDetector queries SessionCoordinator
3. **Analyze:** 3 detection types run in parallel
4. **Aggregate:** Combine results, calculate confidence
5. **Check:** Apply cooldown logic
6. **Output:** Stuck status + detected patterns
7. **If stuck:** Generate recovery suggestions
8. **Search:** Query session memory (Qdrant)
9. **Rank:** Composite scoring (relevance + recency + success)
10. **Display:** Top 3 actionable suggestions

---

## Contributing

Found a bug or have a suggestion?

1. Check existing issues in MCP server repo
2. Create new issue with:
   - Stuck pattern type
   - Session context
   - Expected vs actual behavior
3. Include session stats if possible:
   ```typescript
   mcp__context-engineering__get_session_stats()
   ```

---

## Related Documentation

- [Session Coordination Guide](./SESSION_COORDINATION_GUIDE.md)
- [Qdrant Integration Guide](./QDRANT_INTEGRATION_GUIDE.md)
- [Context Engineering Guide](../../../ClaudeDev/docs/guides/CONTEXT_ENGINEERING_GUIDE.md)

---

**For questions or support, reference ADR-009 (Stuck Detection System) in the ClaudeDev repository.**
