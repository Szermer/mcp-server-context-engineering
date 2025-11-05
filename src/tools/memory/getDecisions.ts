/**
 * getDecisions Tool
 *
 * Retrieves all decision notes from current session memory.
 * Used to review technical decisions made during development.
 *
 * Token usage: ~100-300 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getDecisions as getDecisionsList } from '../../utils/memory.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getDecisionsTool: Tool = {
  name: 'getDecisions',
  description:
    'Retrieve all decision notes from current session memory for a project.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to project directory',
      },
    },
    required: ['projectPath'],
  },
};

interface GetDecisionsInput {
  projectPath: string;
}

interface GetDecisionsOutput {
  success: boolean;
  data?: string[];
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    decisionsCount: number;
    duration: number;
  };
}

/**
 * Handler for getDecisions tool
 */
export async function getDecisionsHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as GetDecisionsInput;

    if (!input.projectPath) {
      throw new Error('projectPath is required');
    }

    const result = await getDecisions(input);

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

    const errorResult: GetDecisionsOutput = {
      success: false,
      error: {
        code: 'GET_DECISIONS_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        decisionsCount: 0,
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
 * Core get decisions logic
 */
async function getDecisions(input: GetDecisionsInput): Promise<GetDecisionsOutput> {
  const startTime = Date.now();

  try {
    const decisions = await getDecisionsList(input.projectPath);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON(decisions);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: decisions,
      metadata: {
        tokensUsed,
        decisionsCount: decisions.length,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'GET_DECISIONS_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        decisionsCount: 0,
        duration,
      },
    };
  }
}
