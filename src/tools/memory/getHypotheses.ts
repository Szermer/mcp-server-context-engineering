/**
 * getHypotheses Tool
 *
 * Retrieves all hypothesis notes from current session memory.
 * Used to review working theories and assumptions during development.
 *
 * Token usage: ~100-300 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getHypotheses as getHypothesesList } from '../../utils/memory.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getHypothesesTool: Tool = {
  name: 'getHypotheses',
  description:
    'Retrieve all hypothesis notes from current session memory for a project.',
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

interface GetHypothesesInput {
  projectPath: string;
}

interface GetHypothesesOutput {
  success: boolean;
  data?: string[];
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    hypothesesCount: number;
    duration: number;
  };
}

/**
 * Handler for getHypotheses tool
 */
export async function getHypothesesHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as GetHypothesesInput;

    if (!input.projectPath) {
      throw new Error('projectPath is required');
    }

    const result = await getHypotheses(input);

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

    const errorResult: GetHypothesesOutput = {
      success: false,
      error: {
        code: 'GET_HYPOTHESES_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        hypothesesCount: 0,
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
 * Core get hypotheses logic
 */
async function getHypotheses(input: GetHypothesesInput): Promise<GetHypothesesOutput> {
  const startTime = Date.now();

  try {
    const hypotheses = await getHypothesesList(input.projectPath);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON(hypotheses);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: hypotheses,
      metadata: {
        tokensUsed,
        hypothesesCount: hypotheses.length,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'GET_HYPOTHESES_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        hypothesesCount: 0,
        duration,
      },
    };
  }
}
