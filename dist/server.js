import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { searchPatternsHandler, searchPatternsTool } from './tools/patterns/searchPatterns.js';
import { loadSkillHandler, loadSkillTool } from './tools/patterns/loadSkill.js';
import { executeSkillHandler, executeSkillTool } from './tools/patterns/executeSkill.js';
import { searchArtifactsHandler, searchArtifactsTool } from './tools/artifacts/searchArtifacts.js';
import { loadSessionHandler, loadSessionTool } from './tools/artifacts/loadSession.js';
import { getSessionCodeHandler, getSessionCodeTool } from './tools/artifacts/getSessionCode.js';
import { addNoteHandler, addNoteTool } from './tools/memory/addNote.js';
import { getDecisionsHandler, getDecisionsTool } from './tools/memory/getDecisions.js';
import { getHypothesesHandler, getHypothesesTool } from './tools/memory/getHypotheses.js';
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
        searchArtifactsTool,
        loadSessionTool,
        getSessionCodeTool,
        addNoteTool,
        getDecisionsTool,
        getHypothesesTool,
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
                case 'searchArtifacts':
                    return await searchArtifactsHandler(args);
                case 'loadSession':
                    return await loadSessionHandler(args);
                case 'getSessionCode':
                    return await getSessionCodeHandler(args);
                case 'addNote':
                    return await addNoteHandler(args);
                case 'getDecisions':
                    return await getDecisionsHandler(args);
                case 'getHypotheses':
                    return await getHypothesesHandler(args);
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