/**
 * searchArtifacts Tool
 *
 * Searches finalization packs across projects by keyword.
 * Returns session metadata for progressive loading.
 *
 * Token usage: ~200-500 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { searchArtifactsInProjects, SessionMetadata } from '../../utils/artifacts.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const searchArtifactsTool: Tool = {
  name: 'searchArtifacts',
  description:
    'Search finalization packs (session artifacts) across projects by keyword. Returns session metadata.',
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

interface SearchArtifactsInput {
  keyword?: string;
  project?: string;
  limit?: number;
}

interface SearchArtifactsOutput {
  success: boolean;
  data?: SessionMetadata[];
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    resultsCount: number;
    duration: number;
  };
}

/**
 * Handler for searchArtifacts tool
 */
export async function searchArtifactsHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as SearchArtifactsInput;
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
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorResult: SearchArtifactsOutput = {
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

/**
 * Core search logic
 */
async function searchArtifacts(input: SearchArtifactsInput): Promise<SearchArtifactsOutput> {
  const startTime = Date.now();

  try {
    const results = await searchArtifactsInProjects(
      input.keyword,
      input.project,
      input.limit ?? 20
    );

    // Calculate token usage
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
  } catch (error) {
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
