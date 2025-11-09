/**
 * MCP Server Configuration
 *
 * Sets up the Model Context Protocol server with tools for context engineering:
 * - Patterns module: searchPatterns, loadSkill, executeSkill
 * - Artifacts module: searchArtifacts, loadSession, getSessionCode
 * - Memory module: addNote, getDecisions, getHypotheses
 * - Metrics module: getCompressionRatio, getPatternReuse
 * - Search module: semanticSearch, indexSession, getSearchStats
 * - Session module: start_session_coordination, save_session_note, session_search,
 *                   check_duplicate_work, get_session_stats, extract_session_memories,
 *                   finalize_session_coordination, track_constraint, get_constraints,
 *                   lift_constraint, check_constraint_violation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool handlers - Patterns module
import { searchPatternsHandler, searchPatternsTool } from './tools/patterns/searchPatterns.js';
import { loadSkillHandler, loadSkillTool } from './tools/patterns/loadSkill.js';
import { executeSkillHandler, executeSkillTool } from './tools/patterns/executeSkill.js';

// Import tool handlers - Artifacts module
import { searchArtifactsHandler, searchArtifactsTool } from './tools/artifacts/searchArtifacts.js';
import { loadSessionHandler, loadSessionTool } from './tools/artifacts/loadSession.js';
import { getSessionCodeHandler, getSessionCodeTool } from './tools/artifacts/getSessionCode.js';

// Import tool handlers - Memory module
import { addNoteHandler, addNoteTool } from './tools/memory/addNote.js';
import { getDecisionsHandler, getDecisionsTool } from './tools/memory/getDecisions.js';
import { getHypothesesHandler, getHypothesesTool } from './tools/memory/getHypotheses.js';

// Import tool handlers - Metrics module
import { getCompressionRatioHandler, getCompressionRatioTool } from './tools/metrics/getCompressionRatio.js';
import { getPatternReuseHandler, getPatternReuseTool } from './tools/metrics/getPatternReuse.js';

// Import tool handlers - Search module
import { semanticSearchHandler, semanticSearchTool } from './tools/search/semanticSearch.js';
import { indexSessionHandler, indexSessionTool } from './tools/search/indexSession.js';
import { getSearchStatsHandler, getSearchStatsTool } from './tools/search/getSearchStats.js';

// Import tool handlers - Session module
import { startSessionCoordinationHandler, startSessionCoordinationTool } from './tools/session/startSessionCoordination.js';
import { saveSessionNoteHandler, saveSessionNoteTool } from './tools/session/saveSessionNote.js';
import { sessionSearchHandler, sessionSearchTool } from './tools/session/sessionSearch.js';
import { checkDuplicateWorkHandler, checkDuplicateWorkTool } from './tools/session/checkDuplicateWork.js';
import { getSessionStatsHandler, getSessionStatsTool } from './tools/session/getSessionStats.js';
import { extractSessionMemoriesHandler, extractSessionMemoriesTool } from './tools/session/extractSessionMemories.js';
import { finalizeSessionCoordinationHandler, finalizeSessionCoordinationTool } from './tools/session/finalizeSessionCoordination.js';
import { trackConstraintHandler, trackConstraintTool } from './tools/session/trackConstraint.js';
import { getConstraintsHandler, getConstraintsTool } from './tools/session/getConstraints.js';
import { liftConstraintHandler, liftConstraintTool } from './tools/session/liftConstraint.js';
import { checkConstraintViolationHandler, checkConstraintViolationTool } from './tools/session/checkConstraintViolation.js';

/**
 * Creates and configures the MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'mcp-server-context-engineering',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all available tools
  const tools: Tool[] = [
    // Patterns module (3 tools)
    searchPatternsTool,
    loadSkillTool,
    executeSkillTool,

    // Artifacts module (3 tools)
    searchArtifactsTool,
    loadSessionTool,
    getSessionCodeTool,

    // Memory module (3 tools)
    addNoteTool,
    getDecisionsTool,
    getHypothesesTool,

    // Metrics module (2 tools)
    getCompressionRatioTool,
    getPatternReuseTool,

    // Search module (3 tools)
    semanticSearchTool,
    indexSessionTool,
    getSearchStatsTool,

    // Session module (11 tools)
    startSessionCoordinationTool,
    saveSessionNoteTool,
    sessionSearchTool,
    checkDuplicateWorkTool,
    getSessionStatsTool,
    extractSessionMemoriesTool,
    finalizeSessionCoordinationTool,
    trackConstraintTool,
    getConstraintsTool,
    liftConstraintTool,
    checkConstraintViolationTool,
  ];

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        // Patterns module
        case 'searchPatterns':
          return await searchPatternsHandler(args);

        case 'loadSkill':
          return await loadSkillHandler(args);

        case 'executeSkill':
          return await executeSkillHandler(args);

        // Artifacts module
        case 'searchArtifacts':
          return await searchArtifactsHandler(args);

        case 'loadSession':
          return await loadSessionHandler(args);

        case 'getSessionCode':
          return await getSessionCodeHandler(args);

        // Memory module
        case 'addNote':
          return await addNoteHandler(args);

        case 'getDecisions':
          return await getDecisionsHandler(args);

        case 'getHypotheses':
          return await getHypothesesHandler(args);

        // Metrics module
        case 'getCompressionRatio':
          return await getCompressionRatioHandler(args);

        case 'getPatternReuse':
          return await getPatternReuseHandler(args);

        // Search module
        case 'semanticSearch':
          return await semanticSearchHandler(args);

        case 'indexSession':
          return await indexSessionHandler(args);

        case 'getSearchStats':
          return await getSearchStatsHandler(args);

        // Session module
        case 'start_session_coordination':
          return await startSessionCoordinationHandler(args);

        case 'save_session_note':
          return await saveSessionNoteHandler(args);

        case 'session_search':
          return await sessionSearchHandler(args);

        case 'check_duplicate_work':
          return await checkDuplicateWorkHandler(args);

        case 'get_session_stats':
          return await getSessionStatsHandler(args);

        case 'extract_session_memories':
          return await extractSessionMemoriesHandler(args);

        case 'finalize_session_coordination':
          return await finalizeSessionCoordinationHandler(args);

        case 'track_constraint':
          return await trackConstraintHandler(args);

        case 'get_constraints':
          return await getConstraintsHandler(args);

        case 'lift_constraint':
          return await liftConstraintHandler(args);

        case 'check_constraint_violation':
          return await checkConstraintViolationHandler(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Connects the server to stdio transport
 */
export function connectServer(server: Server): void {
  const transport = new StdioServerTransport();
  server.connect(transport);
}
