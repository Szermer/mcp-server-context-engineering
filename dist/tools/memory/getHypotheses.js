import { getHypotheses as getHypothesesList } from '../../utils/memory.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const getHypothesesTool = {
    name: 'getHypotheses',
    description: 'Retrieve all hypothesis notes from current session memory for a project.',
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
export async function getHypothesesHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        if (!input.projectPath) {
            throw new Error('projectPath is required');
        }
        const result = await getHypotheses(input);
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
                code: 'GET_HYPOTHESES_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                hypothesesCount: 0,
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
async function getHypotheses(input) {
    const startTime = Date.now();
    try {
        const hypotheses = await getHypothesesList(input.projectPath);
        const tokensUsed = estimateTokensFromJSON(hypotheses);
        const duration = Date.now() - startTime;
        return {
            success: true,
            data: hypotheses,
            metadata: {
                tokensUsed,
                hypothesesCount: hypotheses.length,
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
                code: 'GET_HYPOTHESES_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                hypothesesCount: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=getHypotheses.js.map