/**
 * getRecoverySuggestions Tool
 *
 * Generate recovery suggestions when a developer is stuck.
 * Searches current session for related solutions and ranks by relevance.
 *
 * Future enhancement: Will integrate Google File Search for historical patterns.
 *
 * Token usage: ~200-800 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from '../session/startSessionCoordination.js';
import { RecoveryEngine, RecoveryAnalysis } from '../../utils/RecoveryEngine.js';
import { StuckPattern } from '../../utils/StuckDetector.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getRecoverySuggestionsTool: Tool = {
  name: 'get_recovery_suggestions',
  description:
    'Generate recovery suggestions when stuck. Searches current session for related solutions and ranks by relevance, recency, and success rate.',
  inputSchema: {
    type: 'object',
    properties: {
      stuckPattern: {
        type: 'object',
        description: 'Stuck pattern detected by check_stuck_pattern tool',
        properties: {
          type: {
            type: 'string',
            enum: ['repeated_blocker', 'no_progress', 'error_loop'],
          },
          detected: {
            type: 'boolean',
          },
          confidence: {
            type: 'number',
          },
          details: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              evidence: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        required: ['type', 'detected', 'confidence', 'details'],
      },
      projectPath: {
        type: 'string',
        description:
          'Absolute path to project directory (e.g., "/Users/username/Dev/PrivateLanguage")',
      },
      maxSuggestions: {
        type: 'number',
        description: 'Maximum number of suggestions to return (default: 3)',
        default: 3,
      },
    },
    required: ['stuckPattern', 'projectPath'],
  },
};

interface GetRecoverySuggestionsInput {
  stuckPattern: StuckPattern;
  projectPath: string;
  maxSuggestions?: number;
}

interface GetRecoverySuggestionsOutput {
  success: boolean;
  data?: RecoveryAnalysis;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    duration: number;
    suggestionCount: number;
  };
}

/**
 * Handler for getRecoverySuggestions tool
 */
export async function getRecoverySuggestionsHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as GetRecoverySuggestionsInput;

    if (!input.stuckPattern) {
      throw new Error('stuckPattern is required');
    }

    if (!input.projectPath) {
      throw new Error('projectPath is required');
    }

    const result = await getRecoverySuggestions(input);

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

    const errorResult: GetRecoverySuggestionsOutput = {
      success: false,
      error: {
        code: 'GET_RECOVERY_SUGGESTIONS_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
        suggestionCount: 0,
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
 * Core get recovery suggestions logic
 */
async function getRecoverySuggestions(
  input: GetRecoverySuggestionsInput
): Promise<GetRecoverySuggestionsOutput> {
  const startTime = Date.now();

  try {
    // Get active session coordinator
    const coordinator = getActiveCoordinator();

    // Create recovery engine
    const engine = new RecoveryEngine(coordinator, input.projectPath);

    // Generate suggestions
    const maxSuggestions = input.maxSuggestions || 3;
    const analysis = await engine.generateSuggestions(
      input.stuckPattern,
      maxSuggestions
    );

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input, analysis });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: analysis,
      metadata: {
        tokensUsed,
        duration,
        suggestionCount: analysis.suggestions.length,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'GET_RECOVERY_SUGGESTIONS_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
        suggestionCount: 0,
      },
    };
  }
}
