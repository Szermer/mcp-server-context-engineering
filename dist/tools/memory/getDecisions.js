import { getDecisions as getDecisionsList } from '../../utils/memory.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const getDecisionsTool = {
    name: 'getDecisions',
    description: 'Retrieve all decision notes from current session memory for a project.',
    inputSchema: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Absolute path to project directory',
            },
        },
        required: ['projectPath'],
    },
};
export async function getDecisionsHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        if (!input.projectPath) {
            throw new Error('projectPath is required');
        }
        const result = await getDecisions(input);
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
                code: 'GET_DECISIONS_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                decisionsCount: 0,
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
async function getDecisions(input) {
    const startTime = Date.now();
    try {
        const decisions = await getDecisionsList(input.projectPath);
        const tokensUsed = estimateTokensFromJSON(decisions);
        const duration = Date.now() - startTime;
        return {
            success: true,
            data: decisions,
            metadata: {
                tokensUsed,
                decisionsCount: decisions.length,
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
                code: 'GET_DECISIONS_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                decisionsCount: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=getDecisions.js.map