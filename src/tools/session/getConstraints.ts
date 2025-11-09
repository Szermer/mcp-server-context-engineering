/**
 * getConstraints Tool
 *
 * Get all active constraints for the current session.
 * Returns constraint details including keywords, scope, and status.
 *
 * Token usage: ~80 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { Constraint } from '../../utils/SessionCoordinator.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getConstraintsTool: Tool = {
  name: 'get_constraints',
  description:
    'Get all active constraints for the current session. Returns constraint details including keywords, scope, and status.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

interface GetConstraintsOutput {
  success: boolean;
  data?: {
    count: number;
    constraints: Constraint[];
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
 * Handler for getConstraints tool
 */
export async function getConstraintsHandler(
  _args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const result = await getConstraints();

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

    const errorResult: GetConstraintsOutput = {
      success: false,
      error: {
        code: 'GET_CONSTRAINTS_ERROR',
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
 * Core get constraints logic
 */
async function getConstraints(): Promise<GetConstraintsOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const constraints = await coordinator.getActiveConstraints();

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ constraints });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        count: constraints.length,
        constraints,
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
        code: 'GET_CONSTRAINTS_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
