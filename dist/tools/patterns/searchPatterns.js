import { getPatternCategories, searchPatternsInCategory, } from '../../utils/filesystem.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const searchPatternsTool = {
    name: 'searchPatterns',
    description: 'Search pattern library by keyword and category. Returns pattern metadata for progressive loading.',
    inputSchema: {
        type: 'object',
        properties: {
            keyword: {
                type: 'string',
                description: 'Keyword to search for in pattern names and descriptions',
            },
            category: {
                type: 'string',
                description: 'Filter by category: database, security, ui, backend, testing, architecture, mcp-integration',
                enum: [
                    'database',
                    'security',
                    'ui',
                    'backend',
                    'testing',
                    'architecture',
                    'mcp-integration',
                ],
            },
            includeExecutable: {
                type: 'boolean',
                description: 'Only return patterns with executable implementations',
                default: false,
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 20,
            },
        },
    },
};
export async function searchPatternsHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        const result = await searchPatterns(input);
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
                code: 'SEARCH_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                resultsCount: 0,
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
async function searchPatterns(input) {
    const startTime = Date.now();
    try {
        let allPatterns = [];
        const categoriesToSearch = input.category
            ? [input.category]
            : await getPatternCategories();
        for (const category of categoriesToSearch) {
            const patterns = await searchPatternsInCategory(category, input.keyword, input.includeExecutable);
            allPatterns = allPatterns.concat(patterns);
        }
        allPatterns.sort((a, b) => {
            if (a.quality !== undefined && b.quality !== undefined) {
                if (a.quality !== b.quality) {
                    return b.quality - a.quality;
                }
            }
            return a.name.localeCompare(b.name);
        });
        const limit = input.limit ?? 20;
        const limitedPatterns = allPatterns.slice(0, limit);
        const tokensUsed = estimateTokensFromJSON(limitedPatterns);
        const duration = Date.now() - startTime;
        return {
            success: true,
            data: limitedPatterns,
            metadata: {
                tokensUsed,
                resultsCount: limitedPatterns.length,
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
                code: 'SEARCH_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                resultsCount: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=searchPatterns.js.map