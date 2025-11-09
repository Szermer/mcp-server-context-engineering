/**
 * liftConstraint Tool
 *
 * Lift (deactivate) a constraint by ID.
 * The constraint will no longer be enforced for violation checks.
 *
 * Token usage: ~60 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const liftConstraintTool: Tool = {
  name: 'lift_constraint',
  description:
    'Lift (deactivate) a constraint by ID. The constraint will no longer be enforced.',
  inputSchema: {
    type: 'object',
    properties: {
      constraintId: {
        type: 'string',
        description: 'The ID of the constraint to lift',
      },
    },
    required: ['constraintId'],
  },
};

interface LiftConstraintInput {
  constraintId: string;
}

interface LiftConstraintOutput {
  success: boolean;
  data?: {
    constraintId: string;
    lifted: boolean;
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
 * Handler for liftConstraint tool
 */
export async function liftConstraintHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as LiftConstraintInput;

    if (!input.constraintId) {
      throw new Error('constraintId is required');
    }

    const result = await liftConstraint(input);

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

    const errorResult: LiftConstraintOutput = {
      success: false,
      error: {
        code: 'LIFT_CONSTRAINT_ERROR',
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
 * Core lift constraint logic
 */
async function liftConstraint(input: LiftConstraintInput): Promise<LiftConstraintOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    await coordinator.liftConstraint(input.constraintId);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        constraintId: input.constraintId,
        lifted: true,
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
        code: 'LIFT_CONSTRAINT_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
