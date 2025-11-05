/**
 * getCompressionRatio Tool
 *
 * Calculates token compression metrics for sessions.
 * Shows how much context was saved through finalization.
 *
 * Token usage: ~100 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  calculateCompressionRatio,
  getProjectCompressionMetrics,
  calculateAggregateCompression,
  CompressionMetrics,
} from '../../utils/metrics.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getCompressionRatioTool: Tool = {
  name: 'getCompressionRatio',
  description:
    'Calculate token compression metrics for sessions. Shows context savings through finalization.',
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

interface GetCompressionRatioInput {
  projectPath: string;
  sessionId?: string;
  aggregate?: boolean;
}

interface GetCompressionRatioOutput {
  success: boolean;
  data?:
    | CompressionMetrics
    | CompressionMetrics[]
    | {
        totalSessions: number;
        avgCompressionRatio: number;
        totalTokensSaved: number;
        bestCompression: CompressionMetrics | null;
        worstCompression: CompressionMetrics | null;
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
 * Handler for getCompressionRatio tool
 */
export async function getCompressionRatioHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as GetCompressionRatioInput;

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
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorResult: GetCompressionRatioOutput = {
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

/**
 * Core metrics calculation logic
 */
async function getCompressionRatio(
  input: GetCompressionRatioInput
): Promise<GetCompressionRatioOutput> {
  const startTime = Date.now();

  try {
    let data;

    if (input.aggregate === true) {
      // Return aggregate statistics
      data = await calculateAggregateCompression(input.projectPath);
    } else if (input.sessionId) {
      // Return specific session metrics
      const sessionMetrics = await calculateCompressionRatio(
        input.projectPath,
        input.sessionId
      );

      if (!sessionMetrics) {
        throw new Error(
          `No metrics found for session: ${input.sessionId}`
        );
      }

      data = sessionMetrics;
    } else {
      // Return all sessions
      data = await getProjectCompressionMetrics(input.projectPath);
    }

    // Calculate token usage
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
  } catch (error) {
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
