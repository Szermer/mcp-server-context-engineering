#!/usr/bin/env node

/**
 * MCP Server for Context Engineering
 *
 * Entry point for the MCP server that exposes context engineering operations
 * as executable tools. Enables progressive skill loading and context-efficient workflows.
 *
 * Usage:
 *   node dist/index.js
 *
 * @see docs/PHASE_2_MCP_SERVER_KICKOFF.md
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
const transport = new StdioServerTransport();

server.connect(transport);

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down...');
  process.exit(0);
});
