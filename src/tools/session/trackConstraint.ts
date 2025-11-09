/**
 * trackConstraint Tool
 *
 * Track a constraint (explicit or auto-detected) that should be enforced throughout the session.
 * Constraints are tracked in session memory and checked against proposed actions.
 *
 * Token usage: ~100 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { Constraint } from '../../utils/SessionCoordinator.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const trackConstraintTool: Tool = {
  name: 'track_constraint',
  description:
    'Track a constraint that should be enforced throughout the session. Extracts keywords automatically for fast violation detection.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The constraint to track (e.g., "No external API calls during data processing")',
      },
      scope: {
        type: 'string',
        enum: ['session', 'task', 'file'],
        description: 'Scope of the constraint (default: session)',
      },
      detected_from: {
        type: 'string',
        enum: ['auto', 'explicit'],
        description: 'How the constraint was detected (default: explicit)',
      },
    },
    required: ['content'],
  },
};

interface TrackConstraintInput {
  content: string;
  scope?: 'session' | 'task' | 'file';
  detected_from?: 'auto' | 'explicit';
}

interface TrackConstraintOutput {
  success: boolean;
  constraint?: Constraint;
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
 * Handler for trackConstraint tool
 */
export async function trackConstraintHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as TrackConstraintInput;

    if (!input.content) {
      throw new Error('content is required');
    }

    const result = await trackConstraint(input);

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

    const errorResult: TrackConstraintOutput = {
      success: false,
      error: {
        code: 'TRACK_CONSTRAINT_ERROR',
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
 * Core track constraint logic
 */
async function trackConstraint(input: TrackConstraintInput): Promise<TrackConstraintOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const constraint = await coordinator.trackConstraint(
      input.content,
      input.detected_from || 'explicit',
      input.scope || 'session'
    );

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input, constraint });
    const duration = Date.now() - startTime;

    return {
      success: true,
      constraint,
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
        code: 'TRACK_CONSTRAINT_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
