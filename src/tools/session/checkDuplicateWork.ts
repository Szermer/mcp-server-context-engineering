/**
 * checkDuplicateWork Tool
 *
 * Check if similar work already exists in the current session.
 * Use before starting new tasks to avoid redundancy.
 *
 * Token usage: ~100 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const checkDuplicateWorkTool: Tool = {
  name: 'check_duplicate_work',
  description:
    'Check if similar work already exists in the current session. Use before starting new tasks to avoid redundancy. Returns matches above the similarity threshold.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Description of the work you want to do',
      },
      threshold: {
        type: 'number',
        description: 'Similarity threshold (0.0-1.0, default: 0.75)',
      },
    },
    required: ['description'],
  },
};

interface CheckDuplicateInput {
  description: string;
  threshold?: number;
}

interface CheckDuplicateOutput {
  success: boolean;
  data?: {
    description: string;
    duplicatesFound: boolean;
    duplicates: Array<{
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
 * Handler for checkDuplicateWork tool
 */
export async function checkDuplicateWorkHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as CheckDuplicateInput;

    if (!input.description) {
      throw new Error('description is required');
    }

    const result = await checkDuplicate(input);

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

    const errorResult: CheckDuplicateOutput = {
      success: false,
      error: {
        code: 'CHECK_DUPLICATE_ERROR',
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
 * Core duplicate check logic
 */
async function checkDuplicate(input: CheckDuplicateInput): Promise<CheckDuplicateOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const duplicates = await coordinator.checkDuplicate(
      input.description,
      input.threshold || 0.75
    );

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input, duplicates });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        description: input.description,
        duplicatesFound: duplicates.length > 0,
        duplicates: duplicates.map(d => ({
          score: d.score,
          type: d.type,
          content: d.content,
          timestamp: d.timestamp,
        })),
        count: duplicates.length,
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
        code: 'CHECK_DUPLICATE_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
