/**
 * trackPatternUsage Tool
 *
 * Records when a pattern is used in a project.
 * Automatically promotes patterns to "Verified" status at usage_count >= 3.
 *
 * Part of ADR-007 Week 3: Hybrid Pattern Library
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PatternIndexer } from '../../utils/PatternIndexer.js';

/**
 * Tool definition for MCP
 */
export const trackPatternUsageTool: Tool = {
  name: 'trackPatternUsage',
  description:
    'Track pattern usage. Increments usage count and auto-promotes to "Verified" at 3+ uses.',
  inputSchema: {
    type: 'object',
    properties: {
      patternId: {
        type: 'string',
        description: 'Pattern ID (e.g., "database/database-001-test-pattern")',
      },
      projectPath: {
        type: 'string',
        description: 'Path to project where pattern was used',
      },
      context: {
        type: 'string',
        description: 'Brief description of how pattern was applied (optional)',
      },
    },
    required: ['patternId'],
  },
};

interface TrackUsageInput {
  patternId: string;
  projectPath?: string;
  context?: string;
}

interface TrackUsageOutput {
  success: boolean;
  data?: {
    patternId: string;
    usageCount: number;
    promoted: boolean;
    verified: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    duration: number;
  };
}

/**
 * Handler for trackPatternUsage tool
 */
export async function trackPatternUsageHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as TrackUsageInput;
    const result = await trackPatternUsage(input);

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

    const errorResult: TrackUsageOutput = {
      success: false,
      error: {
        code: 'TRACKING_ERROR',
        message: errorMessage,
      },
      metadata: {
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
 * Core tracking logic
 */
async function trackPatternUsage(input: TrackUsageInput): Promise<TrackUsageOutput> {
  const startTime = Date.now();

  try {
    const indexer = new PatternIndexer();
    await indexer.initializeQdrantCollection();

    // Track usage (this also handles promotion internally)
    await indexer.trackUsage(input.patternId);

    // Get updated pattern info
    const patterns = await indexer.searchFast('', { limit: 1000 });
    const pattern = patterns.find((p) => p.id === input.patternId);

    if (!pattern) {
      throw new Error(`Pattern ${input.patternId} not found after tracking`);
    }

    const duration = Date.now() - startTime;
    const promoted = pattern.usageCount === 3; // Just promoted

    return {
      success: true,
      data: {
        patternId: input.patternId,
        usageCount: pattern.usageCount,
        promoted,
        verified: pattern.verified || false,
      },
      metadata: {
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'TRACKING_ERROR',
        message: errorMessage,
      },
      metadata: {
        duration,
      },
    };
  }
}
