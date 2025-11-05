import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { searchPatternsHandler, searchPatternsTool } from './tools/patterns/searchPatterns.js';
import { loadSkillHandler, loadSkillTool } from './tools/patterns/loadSkill.js';
import { executeSkillHandler, executeSkillTool } from './tools/patterns/executeSkill.js';
export function createServer() {
    const server = new Server({
        name: 'mcp-server-context-engineering',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    const tools = [
        searchPatternsTool,
        loadSkillTool,
        executeSkillTool,
    ];
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case 'searchPatterns':
                    return await searchPatternsHandler(args);
                case 'loadSkill':
                    return await loadSkillHandler(args);
                case 'executeSkill':
                    return await executeSkillHandler(args);
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        }
        catch (error) {
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
export function connectServer(server) {
    const transport = new StdioServerTransport();
    server.connect(transport);
}
//# sourceMappingURL=server.js.map