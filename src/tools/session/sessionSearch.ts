/**
 * sessionSearch Tool
 *
 * Search current session memory using semantic search.
 * Returns relevant notes in 50-200ms.
 *
 * Token usage: ~100 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const sessionSearchTool: Tool = {
  name: 'session_search',
  description:
    'Search current session memory using semantic search. Returns relevant notes in 50-200ms. Use this to recall decisions, check hypotheses, or find blockers.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "authentication decisions", "database performance")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 5)',
      },
    },
    required: ['query'],
  },
};

interface SessionSearchInput {
  query: string;
  limit?: number;
}

interface SessionSearchOutput {
  success: boolean;
  data?: {
    query: string;
    results: Array<{
      score: number;
      type: string;
      content: string;
      timestamp: string;
    }>;
    count: number;
  };
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    duration: number;
  };
}

/**
 * Handler for sessionSearch tool
 */
export async function sessionSearchHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as SessionSearchInput;

    if (!input.query) {
      throw new Error('query is required');
    }

    const result = await searchSession(input);

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

    const errorResult: SessionSearchOutput = {
      success: false,
      error: {
        code: 'SESSION_SEARCH_ERROR',
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

/**
 * Core session search logic
 */
async function searchSession(input: SessionSearchInput): Promise<SessionSearchOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const results = await coordinator.search(input.query, input.limit || 5);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input, results });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        query: input.query,
        results: results.map(r => ({
          score: r.score,
          type: r.type,
          content: r.content,
          timestamp: r.timestamp,
        })),
        count: results.length,
      },
      metadata: {
        tokensUsed,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'SESSION_SEARCH_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
