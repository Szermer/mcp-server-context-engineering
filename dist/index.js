#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
const server = createServer();
const transport = new StdioServerTransport();
server.connect(transport);
process.on('SIGINT', () => {
    console.error('Received SIGINT, shutting down...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.error('Received SIGTERM, shutting down...');
    process.exit(0);
});
//# sourceMappingURL=index.js.map