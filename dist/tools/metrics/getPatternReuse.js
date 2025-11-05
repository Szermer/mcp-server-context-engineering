import { trackPatternReuse, getAllPatternReuseMetrics, } from '../../utils/metrics.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const getPatternReuseTool = {
    name: 'getPatternReuse',
    description: 'Track pattern reuse statistics across projects. Shows which patterns are most valuable.',
    inputSchema: {
        type: 'object',
        properties: {
            patternId: {
                type: 'string',
                description: 'Specific pattern ID to track (e.g., "database/rls-policy"). Omit to get all patterns.',
            },
            minReuseCount: {
                type: 'number',
                description: 'Filter patterns with at least this many reuses',
                default: 1,
            },
            sortBy: {
                type: 'string',
                enum: ['reuseCount', 'recent', 'category'],
                description: 'Sort results by criteria',
                default: 'reuseCount',
            },
        },
    },
};
export async function getPatternReuseHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        const result = await getPatternReuse(input);
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
                code: 'REUSE_METRICS_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                patternsCount: 0,
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
async function getPatternReuse(input) {
    const startTime = Date.now();
    try {
        let data;
        if (input.patternId) {
            const metrics = await trackPatternReuse(input.patternId);
            if (!metrics) {
                throw new Error(`No reuse data found for pattern: ${input.patternId}`);
            }
            data = metrics;
        }
        else {
            let allMetrics = await getAllPatternReuseMetrics();
            if (input.minReuseCount && input.minReuseCount > 1) {
                allMetrics = allMetrics.filter((m) => m.reuseCount >= (input.minReuseCount || 1));
            }
            const sortBy = input.sortBy || 'reuseCount';
            if (sortBy === 'reuseCount') {
                allMetrics.sort((a, b) => b.reuseCount - a.reuseCount);
            }
            else if (sortBy === 'recent') {
                allMetrics.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
            }
            else if (sortBy === 'category') {
                allMetrics.sort((a, b) => {
                    if (a.category !== b.category) {
                        return a.category.localeCompare(b.category);
                    }
                    return b.reuseCount - a.reuseCount;
                });
            }
            data = allMetrics;
        }
        const tokensUsed = estimateTokensFromJSON(data);
        const duration = Date.now() - startTime;
        const patternsCount = Array.isArray(data) ? data.length : 1;
        return {
            success: true,
            data,
            metadata: {
                tokensUsed,
                patternsCount,
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
                code: 'REUSE_METRICS_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                patternsCount: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=getPatternReuse.js.map