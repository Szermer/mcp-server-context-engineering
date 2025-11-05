# Documentation Index

**Version:** 1.0.0
**Last Updated:** 2025-11-05

---

## Quick Navigation

### I want to...

**...understand what this project does**
→ Start with [README.md](./README.md)

**...understand the architecture and design principles**
→ Read [ARCHITECTURE.md](./ARCHITECTURE.md)

**...understand why specific technical decisions were made**
→ Read [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)

**...add a new tool or contribute code**
→ Follow [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

**...understand the implementation plan**
→ Read [Phase 2 Kickoff](../ClaudeDev/docs/PHASE_2_MCP_SERVER_KICKOFF.md)

**...understand the strategic context**
→ Read [ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md)

---

## Documentation Hierarchy

### Level 1: Quick Start (5-10 minutes)

**[README.md](./README.md)** - Project overview
- What the MCP server does
- Quick installation and setup
- Usage examples
- Development status

**Who should read:** Everyone

---

### Level 2: Developer Guides (30-60 minutes)

**[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Practical development guide
- Setting up development environment
- Adding a new tool (step-by-step)
- Testing strategies
- Working with filesystem
- Debugging techniques
- Common pitfalls
- Code review checklist

**Who should read:** Developers extending the server, contributors

---

### Level 3: Architecture Deep Dives (1-2 hours)

**[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- Architectural principles (progressive disclosure, separation of concerns, etc.)
- System architecture diagrams
- Module design and organization
- Key design decisions with rationale
- Implementation patterns
- Performance considerations
- Security considerations
- Testing strategy
- Future extensibility
- Trade-offs and alternatives

**Who should read:** Architects, senior developers, anyone making significant changes

**[DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)** - Technical decisions reference
- Module organization decisions
- Type system design
- Error handling strategy
- Filesystem conventions
- Token estimation approach
- Testing infrastructure
- Performance optimization
- Tool interface design

**Who should read:** Developers who want to understand the "why" behind every implementation choice

---

### Level 4: Strategic Context (2-3 hours)

**[ADR-006: MCP Code Execution Integration](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md)**
- Strategic context for MCP integration
- Problem statement (tool definition overload, token waste)
- Four-phase implementation plan
- Alternatives considered
- Success criteria
- Risk mitigation

**Who should read:** Product managers, architects, decision makers

**[Phase 2 Kickoff: MCP Server Implementation](../ClaudeDev/docs/PHASE_2_MCP_SERVER_KICKOFF.md)**
- 4-week implementation timeline
- Week-by-week objectives
- Tool specifications
- Testing strategy
- Integration plan
- Success metrics

**Who should read:** Project managers, team leads, developers planning work

---

## By Topic

### Architecture & Design
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - High-level architecture
2. [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Detailed design choices
3. [ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md) - Strategic architecture decision

### Development
1. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Developer workflow and patterns
2. [README.md](./README.md) - Quick start and installation

### Planning & Process
1. [Phase 2 Kickoff](../ClaudeDev/docs/PHASE_2_MCP_SERVER_KICKOFF.md) - Implementation plan
2. [ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md) - Strategic context

### Related Systems
1. [Executable Skills Guide](../ClaudeDev/docs/guides/EXECUTABLE_SKILLS_GUIDE.md) - Pattern library skills
2. [MCP Architecture](~/.shared-patterns/mcp-integration/ARCHITECTURE.md) - Three-file pattern design

---

## Document Relationships

```
Strategic Context
    │
    ├─ ADR-006: MCP Code Execution Integration
    │   └─ Defines overall vision and phases
    │
    └─ Phase 2 Kickoff
        └─ Defines 4-week implementation plan
            │
            ├─ ARCHITECTURE.md
            │   └─ Explains system architecture and design principles
            │       │
            │       └─ DESIGN_DECISIONS.md
            │           └─ Details every technical decision
            │
            └─ DEVELOPER_GUIDE.md
                └─ Practical guide for implementation
                    │
                    └─ README.md
                        └─ Quick start and usage
```

---

## Reading Paths

### Path 1: New User
1. [README.md](./README.md) - Understand what it does
2. Try running the examples
3. (Optional) [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand how it works

**Time:** 15-30 minutes

---

### Path 2: New Developer
1. [README.md](./README.md) - Quick start
2. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Development workflow
3. Try adding a simple tool (follow guide step-by-step)
4. [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
5. [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Understand the decisions

**Time:** 2-3 hours

---

### Path 3: Architect / Decision Maker
1. [ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md) - Strategic context
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
3. [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Technical decisions
4. [Phase 2 Kickoff](../ClaudeDev/docs/PHASE_2_MCP_SERVER_KICKOFF.md) - Implementation plan
5. [README.md](./README.md) - Current status

**Time:** 3-4 hours

---

### Path 4: Code Reviewer
1. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Development patterns
2. [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - What to look for
3. Review code against patterns in guides
4. Check against [Code Review Checklist](./DEVELOPER_GUIDE.md#code-review-checklist)

**Time:** 1 hour + review time

---

## Document Statistics

| Document | Lines | Size | Reading Time | Audience |
|----------|-------|------|--------------|----------|
| README.md | 213 | 6.6 KB | 5-10 min | Everyone |
| DEVELOPER_GUIDE.md | 800+ | 25 KB | 30-60 min | Developers |
| ARCHITECTURE.md | 1000+ | 40 KB | 1-2 hours | Architects |
| DESIGN_DECISIONS.md | 800+ | 30 KB | 1-2 hours | Tech leads |
| ADR-006 | 580 | 33 KB | 1-2 hours | Decision makers |
| Phase 2 Kickoff | 620 | 31 KB | 1 hour | Project managers |

---

## External Resources

### MCP Protocol
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://modelcontextprotocol.io/docs/sdk)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)

### Anthropic Resources
- [Code execution with MCP: building more efficient AI agents](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Claude Code Documentation](https://docs.anthropic.com/claude/docs/claude-code)

### Related Technologies
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Node.js Documentation](https://nodejs.org/docs/)

---

## Keeping Documentation Current

When you make changes to the codebase:

**Update these docs when:**
- Adding a new tool → Update README.md and DEVELOPER_GUIDE.md
- Changing architecture → Update ARCHITECTURE.md
- Making technical decisions → Update DESIGN_DECISIONS.md
- Changing development workflow → Update DEVELOPER_GUIDE.md
- Completing milestones → Update README.md status

**Document update checklist:**
- [ ] Update "Last Updated" date
- [ ] Update version number (if versioned)
- [ ] Update code examples if affected
- [ ] Update performance metrics if measured
- [ ] Update status indicators (✅, ⚠️, ❌)

---

## Questions?

**For questions about:**
- **Usage** → See [README.md](./README.md)
- **Development** → See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **Architecture** → See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Decisions** → See [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)
- **Strategic context** → See [ADR-006](../ClaudeDev/docs/architecture/decisions/006-mcp-code-execution-integration.md)

**Still have questions?**
- File an issue on GitHub
- Contact the maintainers
- Review the code (it's well-commented!)

---

**Last Updated:** 2025-11-05
**Maintainer:** Stephen Szermer
**Version:** 1.0.0
