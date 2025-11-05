# Documentation Index

**Version:** 1.0.0
**Last Updated:** 2025-11-05

---

## Quick Navigation

### I want to...

**...understand what this project does**
→ Start with [README.md](../README.md)

**...understand the architecture and design principles**
→ Read [ARCHITECTURE.md](./ARCHITECTURE.md)

**...understand why specific technical decisions were made**
→ Read [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)

**...add a new tool or contribute code**
→ Follow [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

**...explore all documentation**
→ See full index below

---

## Documentation Hierarchy

### Level 1: Quick Start (5-10 minutes)

**[README.md](../README.md)** - Project overview
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

## By Topic

### Architecture & Design
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - High-level architecture
2. [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Detailed design choices

### Development
1. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Developer workflow and patterns
2. [README.md](../README.md) - Quick start and installation
3. [CLAUDE.md](../CLAUDE.md) - Claude Code integration guide

---

## Document Relationships

```
ARCHITECTURE.md (docs/)
    └─ System architecture and design principles
        │
        ├─ DESIGN_DECISIONS.md (docs/)
        │   └─ Details every technical decision
        │
        └─ DEVELOPER_GUIDE.md (docs/)
            └─ Practical guide for implementation
                │
                ├─ CLAUDE.md (root)
                │   └─ Claude Code integration
                │
                └─ README.md (root)
                    └─ Quick start and usage
```

---

## Reading Paths

### Path 1: New User
1. [README.md](../README.md) - Understand what it does
2. Try running the examples
3. (Optional) [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand how it works

**Time:** 15-30 minutes

---

### Path 2: New Developer
1. [README.md](../README.md) - Quick start
2. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Development workflow
3. Try adding a simple tool (follow guide step-by-step)
4. [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
5. [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Understand the decisions

**Time:** 2-3 hours

---

### Path 3: Architect / Technical Lead
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
2. [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Technical decisions
3. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Implementation patterns
4. [README.md](../README.md) - Current status

**Time:** 2-3 hours

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
| README.md | 210 | 6.5 KB | 5-10 min | Everyone |
| DEVELOPER_GUIDE.md | 800+ | 25 KB | 30-60 min | Developers |
| ARCHITECTURE.md | 1000+ | 40 KB | 1-2 hours | Architects |
| DESIGN_DECISIONS.md | 800+ | 30 KB | 1-2 hours | Tech leads |
| CLAUDE.md | 500+ | 20 KB | 30-45 min | Claude Code users |
| DOCUMENTATION_INDEX.md | 250+ | 8 KB | 15 min | All (navigation) |

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
- **Usage** → See [README.md](../README.md)
- **Development** → See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **Architecture** → See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Decisions** → See [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)
- **Claude Code integration** → See [CLAUDE.md](../CLAUDE.md)

**Still have questions?**
- File an issue on GitHub
- Review the code (it's well-commented!)
- Check the [External Resources](#external-resources) section

---

**Last Updated:** 2025-11-05
**Maintainer:** Stephen Szermer
**Version:** 1.0.0
