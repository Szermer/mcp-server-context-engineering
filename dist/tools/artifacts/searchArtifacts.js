import { searchArtifactsInProjects } from '../../utils/artifacts.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const searchArtifactsTool = {
    name: 'searchArtifacts',
    description: 'Search finalization packs (session artifacts) across projects by keyword. Returns session metadata.',
    inputSchema: {
        type: 'object',
        properties: {
            keyword: {
                type: 'string',
                description: 'Keyword to search in session titles and summaries',
            },
            project: {
                type: 'string',
                description: 'Limit search to specific project name',
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 20,
            },
        },
    },
};
export async function searchArtifactsHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        const result = await searchArtifacts(input);
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
async function searchArtifacts(input) {
    const startTime = Date.now();
    try {
        const results = await searchArtifactsInProjects(input.keyword, input.project, input.limit ?? 20);
        const tokensUsed = estimateTokensFromJSON(results);
        const duration = Date.now() - startTime;
        return {
            success: true,
            data: results,
            metadata: {
                tokensUsed,
                resultsCount: results.length,
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
//# sourceMappingURL=searchArtifacts.js.map