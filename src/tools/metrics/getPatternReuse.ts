/**
 * getPatternReuse Tool
 *
 * Tracks pattern reuse statistics across projects.
 * Shows which patterns are most valuable and frequently reused.
 *
 * Token usage: ~100 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  trackPatternReuse,
  getAllPatternReuseMetrics,
  PatternReuseMetrics,
} from '../../utils/metrics.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getPatternReuseTool: Tool = {
  name: 'getPatternReuse',
  description:
    'Track pattern reuse statistics across projects. Shows which patterns are most valuable.',
  inputSchema: {
    type: 'object',
    properties: {
      patternId: {
        type: 'string',
        description:
          'Specific pattern ID to track (e.g., "database/rls-policy"). Omit to get all patterns.',
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

interface GetPatternReuseInput {
  patternId?: string;
  minReuseCount?: number;
  sortBy?: 'reuseCount' | 'recent' | 'category';
}

interface GetPatternReuseOutput {
  success: boolean;
  data?: PatternReuseMetrics | PatternReuseMetrics[];
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    patternsCount: number;
    duration: number;
  };
}

/**
 * Handler for getPatternReuse tool
 */
export async function getPatternReuseHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as GetPatternReuseInput;
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
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorResult: GetPatternReuseOutput = {
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

/**
 * Core reuse metrics logic
 */
async function getPatternReuse(
  input: GetPatternReuseInput
): Promise<GetPatternReuseOutput> {
  const startTime = Date.now();

  try {
    let data: PatternReuseMetrics | PatternReuseMetrics[];

    if (input.patternId) {
      // Track specific pattern
      const metrics = await trackPatternReuse(input.patternId);

      if (!metrics) {
        throw new Error(`No reuse data found for pattern: ${input.patternId}`);
      }

      data = metrics;
    } else {
      // Get all patterns
      let allMetrics = await getAllPatternReuseMetrics();

      // Filter by minimum reuse count
      if (input.minReuseCount && input.minReuseCount > 1) {
        allMetrics = allMetrics.filter(
          (m) => m.reuseCount >= (input.minReuseCount || 1)
        );
      }

      // Sort results
      const sortBy = input.sortBy || 'reuseCount';
      if (sortBy === 'reuseCount') {
        allMetrics.sort((a, b) => b.reuseCount - a.reuseCount);
      } else if (sortBy === 'recent') {
        allMetrics.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
      } else if (sortBy === 'category') {
        allMetrics.sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return b.reuseCount - a.reuseCount;
        });
      }

      data = allMetrics;
    }

    // Calculate token usage
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
  } catch (error) {
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
