/**
 * startSessionCoordination Tool
 *
 * Initialize Qdrant session memory for real-time coordination.
 * Call this at the start of a session to enable fast semantic search and duplicate detection.
 *
 * Token usage: ~100 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SessionCoordinator } from '../../utils/SessionCoordinator.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

// Global coordinator instance (single active session at a time)
let activeCoordinator: SessionCoordinator | null = null;

/**
 * Tool definition for MCP
 */
export const startSessionCoordinationTool: Tool = {
  name: 'start_session_coordination',
  description:
    'Initialize Qdrant session memory for real-time coordination. Call this at the start of a session to enable fast semantic search and duplicate detection.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session identifier (e.g., "2025-11-09-auth-work")',
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to project directory (e.g., "/Users/username/Dev/PrivateLanguage")',
      },
    },
    required: ['sessionId', 'projectPath'],
  },
};

interface StartSessionInput {
  sessionId: string;
  projectPath: string;
}

interface StartSessionOutput {
  success: boolean;
  data?: {
    sessionId: string;
    projectPath: string;
    collectionName: string;
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
 * Handler for startSessionCoordination tool
 */
export async function startSessionCoordinationHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as StartSessionInput;

    if (!input.sessionId) {
      throw new Error('sessionId is required');
    }

    if (!input.projectPath) {
      throw new Error('projectPath is required');
    }

    const result = await startSession(input);

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

    const errorResult: StartSessionOutput = {
      success: false,
      error: {
        code: 'START_SESSION_ERROR',
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
 * Core start session logic
 */
async function startSession(input: StartSessionInput): Promise<StartSessionOutput> {
  const startTime = Date.now();

  try {
    // Check if a session is already active
    if (activeCoordinator) {
      throw new Error('Session already active. Call finalize_session_coordination first.');
    }

    // Create new coordinator
    const coordinator = new SessionCoordinator(input.sessionId, input.projectPath);

    // Initialize Qdrant collection
    await coordinator.initialize();

    // Store as active coordinator
    activeCoordinator = coordinator;

    const projectName = input.projectPath.split('/').pop() || 'default';
    const collectionName = `session-${projectName}-${input.sessionId}`;

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input, collectionName });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        sessionId: input.sessionId,
        projectPath: input.projectPath,
        collectionName,
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
        code: 'START_SESSION_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}

/**
 * Get active coordinator (for use by other tools)
 */
export function getActiveCoordinator(): SessionCoordinator {
  if (!activeCoordinator) {
    throw new Error('No active session. Call start_session_coordination first.');
  }
  return activeCoordinator;
}

/**
 * Clear active coordinator (for use by finalize tool)
 */
export function clearActiveCoordinator(): void {
  activeCoordinator = null;
}
