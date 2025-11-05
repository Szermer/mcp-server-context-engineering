import { calculateCompressionRatio, getProjectCompressionMetrics, calculateAggregateCompression, } from '../../utils/metrics.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const getCompressionRatioTool = {
    name: 'getCompressionRatio',
    description: 'Calculate token compression metrics for sessions. Shows context savings through finalization.',
    inputSchema: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Absolute path to project directory',
            },
            sessionId: {
                type: 'string',
                description: 'Specific session ID to analyze (optional - returns all if omitted)',
            },
            aggregate: {
                type: 'boolean',
                description: 'Return aggregate statistics across all sessions',
                default: false,
            },
        },
        required: ['projectPath'],
    },
};
export async function getCompressionRatioHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        if (!input.projectPath) {
            throw new Error('projectPath is required');
        }
        const result = await getCompressionRatio(input);
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
                code: 'METRICS_ERROR',
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
async function getCompressionRatio(input) {
    const startTime = Date.now();
    try {
        let data;
        if (input.aggregate === true) {
            data = await calculateAggregateCompression(input.projectPath);
        }
        else if (input.sessionId) {
            const sessionMetrics = await calculateCompressionRatio(input.projectPath, input.sessionId);
            if (!sessionMetrics) {
                throw new Error(`No metrics found for session: ${input.sessionId}`);
            }
            data = sessionMetrics;
        }
        else {
            data = await getProjectCompressionMetrics(input.projectPath);
        }
        const tokensUsed = estimateTokensFromJSON(data);
        const duration = Date.now() - startTime;
        return {
            success: true,
            data,
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
                code: 'METRICS_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=getCompressionRatio.js.map