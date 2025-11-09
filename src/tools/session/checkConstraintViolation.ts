/**
 * checkConstraintViolation Tool
 *
 * Check if a proposed action would violate any active constraints.
 * Uses both semantic similarity and keyword matching for detection.
 *
 * Token usage: ~200 tokens (includes embedding generation)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { Constraint } from '../../utils/SessionCoordinator.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const checkConstraintViolationTool: Tool = {
  name: 'check_constraint_violation',
  description:
    'Check if a proposed action would violate any active constraints. Returns violations with severity and reasons.',
  inputSchema: {
    type: 'object',
    properties: {
      proposedAction: {
        type: 'string',
        description: 'The action to check against active constraints (e.g., "npm install axios")',
      },
    },
    required: ['proposedAction'],
  },
};

interface CheckViolationInput {
  proposedAction: string;
}

interface ViolationDetail {
  constraint: Constraint;
  severity: 'high' | 'medium' | 'low';
  reason: string;
}

interface CheckViolationOutput {
  success: boolean;
  data?: {
    violated: boolean;
    violations: ViolationDetail[];
    message: string;
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
 * Handler for checkConstraintViolation tool
 */
export async function checkConstraintViolationHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as CheckViolationInput;

    if (!input.proposedAction) {
      throw new Error('proposedAction is required');
    }

    const result = await checkViolation(input);

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

    const errorResult: CheckViolationOutput = {
      success: false,
      error: {
        code: 'CHECK_VIOLATION_ERROR',
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
 * Core check violation logic
 */
async function checkViolation(input: CheckViolationInput): Promise<CheckViolationOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const result = await coordinator.checkViolation(input.proposedAction);

    // Calculate token usage (includes embedding generation)
    const tokensUsed = estimateTokensFromJSON({ input, result }) + 150; // Add embedding tokens
    const duration = Date.now() - startTime;

    const message = result.violated
      ? `⚠️ Action would violate ${result.violations.length} constraint(s)`
      : '✅ No constraint violations detected';

    return {
      success: true,
      data: {
        violated: result.violated,
        violations: result.violations,
        message,
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
        code: 'CHECK_VIOLATION_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
