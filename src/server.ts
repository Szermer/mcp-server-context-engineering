/**
 * MCP Server Configuration
 *
 * Sets up the Model Context Protocol server with tools for context engineering:
 * - Patterns module: searchPatterns, loadSkill, executeSkill
 * - Artifacts module: searchArtifacts, loadSession, getSessionCode
 * - Memory module: addNote, getDecisions, getHypotheses
 * - Metrics module: getCompressionRatio, getPatternReuse
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
    // More tools will be added as we implement other modules
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
