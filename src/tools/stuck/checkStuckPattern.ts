/**
 * checkStuckPattern Tool
 *
 * Analyze current session state to detect if the developer is stuck.
 *
 * Detection types:
 * 1. Repeated Blocker - Same blocker mentioned 3+ times
 * 2. No Progress - No file changes for 20+ minutes
 * 3. Error Loop - Same error repeating 5+ times
 *
 * Includes cooldown mechanism (max 1 alert per 10 min).
 *
 * Token usage: ~100-500 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from '../session/startSessionCoordination.js';
import { StuckDetector, StuckAnalysis } from '../../utils/StuckDetector.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const checkStuckPatternTool: Tool = {
  name: 'check_stuck_pattern',
  description:
    'Analyze current session state to detect if the developer is stuck. Checks for repeated blockers, lack of progress, and error loops. Includes 10-minute cooldown to prevent alert spam.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description:
          'Absolute path to project directory (e.g., "/Users/username/Dev/PrivateLanguage")',
      },
    },
    required: ['projectPath'],
  },
};

interface CheckStuckInput {
  projectPath: string;
}

interface CheckStuckOutput {
  success: boolean;
  data?: StuckAnalysis;
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
 * Handler for checkStuckPattern tool
 */
export async function checkStuckPatternHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as CheckStuckInput;

    if (!input.projectPath) {
      throw new Error('projectPath is required');
    }

    const result = await checkStuckPattern(input);

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

    const errorResult: CheckStuckOutput = {
      success: false,
      error: {
        code: 'CHECK_STUCK_ERROR',
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
 * Core check stuck pattern logic
 */
async function checkStuckPattern(input: CheckStuckInput): Promise<CheckStuckOutput> {
  const startTime = Date.now();

  try {
    // Get active session coordinator
    const coordinator = getActiveCoordinator();

    // Create stuck detector
    const detector = new StuckDetector(coordinator, input.projectPath);

    // Run analysis
    const analysis = await detector.analyze();

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input, analysis });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: analysis,
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
        code: 'CHECK_STUCK_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
