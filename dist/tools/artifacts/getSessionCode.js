import { extractSessionCode } from '../../utils/artifacts.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const getSessionCodeTool = {
    name: 'getSessionCode',
    description: 'Extract executable code blocks from session artifacts. Filter by programming language.',
    inputSchema: {
        type: 'object',
        properties: {
            project: {
                type: 'string',
                description: 'Project name (e.g., "PrivateLanguage")',
            },
            sessionId: {
                type: 'string',
                description: 'Session ID (e.g., "2025-10-15-authentication-flow")',
            },
            language: {
                type: 'string',
                description: 'Filter by programming language (e.g., "typescript", "python", "sql")',
            },
        },
        required: ['project', 'sessionId'],
    },
};
export async function getSessionCodeHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        if (!input.project) {
            throw new Error('project is required');
        }
        if (!input.sessionId) {
            throw new Error('sessionId is required');
        }
        const result = await getSessionCode(input);
        const responseText = JSON.stringify(result, null, 2);
        return {
            content: [
                {
                    type: 'text',
                    text: responseText,
                },
            ],
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorResult = {
            success: false,
            error: {
                code: 'EXTRACTION_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                codeBlocksCount: 0,
                duration,
            },
        };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(errorResult, null, 2),
                },
            ],
        };
    }
}
async function getSessionCode(input) {
    const startTime = Date.now();
    try {
        const codeBlocks = await extractSessionCode(input.project, input.sessionId, input.language);
        const tokensUsed = estimateTokensFromJSON(codeBlocks);
        const duration = Date.now() - startTime;
        return {
            success: true,
            data: codeBlocks,
            metadata: {
                tokensUsed,
                codeBlocksCount: codeBlocks.length,
                duration,
            },
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: {
                code: 'EXTRACTION_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                codeBlocksCount: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=getSessionCode.js.map