import { loadSessionArtifact } from '../../utils/artifacts.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const loadSessionTool = {
    name: 'loadSession',
    description: 'Load complete session context from finalization pack. Returns structured session data.',
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
            includeCode: {
                type: 'boolean',
                description: 'Include code blocks from session',
                default: false,
            },
        },
        required: ['project', 'sessionId'],
    },
};
export async function loadSessionHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        if (!input.project) {
            throw new Error('project is required');
        }
        if (!input.sessionId) {
            throw new Error('sessionId is required');
        }
        const result = await loadSession(input);
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
                code: 'LOAD_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
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
async function loadSession(input) {
    const startTime = Date.now();
    try {
        const artifact = await loadSessionArtifact(input.project, input.sessionId);
        if (!artifact) {
            throw new Error(`Session not found: ${input.project}/${input.sessionId}`);
        }
        if (input.includeCode !== true) {
            artifact.codeBlocks = undefined;
        }
        const tokensUsed = estimateTokensFromJSON(artifact);
        const duration = Date.now() - startTime;
        return {
            success: true,
            data: artifact,
            metadata: {
                tokensUsed,
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
                code: 'LOAD_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=loadSession.js.map