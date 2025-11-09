/**
 * finalizeSessionCoordination Tool
 *
 * Clean up ephemeral session memory.
 * Call this at the end of a session (during /finalize) to delete the temporary collection.
 *
 * Token usage: ~50 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator, clearActiveCoordinator } from './startSessionCoordination.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const finalizeSessionCoordinationTool: Tool = {
  name: 'finalize_session_coordination',
  description:
    'Clean up ephemeral session memory. Call this at the end of a session (during /finalize) to delete the temporary collection.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

interface FinalizeSessionOutput {
  success: boolean;
  data?: {
    cleaned: boolean;
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
 * Handler for finalizeSessionCoordination tool
 */
export async function finalizeSessionCoordinationHandler(
  _args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const result = await finalizeSession();

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

    const errorResult: FinalizeSessionOutput = {
      success: false,
      error: {
        code: 'FINALIZE_SESSION_ERROR',
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
 * Core finalize session logic
 */
async function finalizeSession(): Promise<FinalizeSessionOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    // Clean up Qdrant collection
    await coordinator.cleanup();

    // Clear active coordinator
    clearActiveCoordinator();

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ finalized: true });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        cleaned: true,
        message: 'Session coordination finalized and cleaned up successfully',
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
        code: 'FINALIZE_SESSION_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
