/**
 * getSessionStats Tool
 *
 * Get statistics about the current session (total notes, notes by type, etc.)
 *
 * Token usage: ~100 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getSessionStatsTool: Tool = {
  name: 'get_session_stats',
  description:
    'Get statistics about the current session (total notes, notes by type, etc.)',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

interface GetStatsOutput {
  success: boolean;
  data?: {
    sessionId: string;
    collection: string;
    totalNotes: number;
    notesByType: Record<string, number>;
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
 * Handler for getSessionStats tool
 */
export async function getSessionStatsHandler(
  _args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const result = await getStats();

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

    const errorResult: GetStatsOutput = {
      success: false,
      error: {
        code: 'GET_STATS_ERROR',
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
 * Core get stats logic
 */
async function getStats(): Promise<GetStatsOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const stats = await coordinator.getStats();

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ stats });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        sessionId: stats.sessionId,
        collection: stats.collection,
        totalNotes: stats.totalNotes,
        notesByType: stats.notesByType,
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
        code: 'GET_STATS_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
