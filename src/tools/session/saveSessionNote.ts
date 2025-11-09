/**
 * saveSessionNote Tool
 *
 * Save a decision, hypothesis, blocker, learning, or pattern to session memory.
 * Indexed immediately for fast retrieval.
 *
 * Token usage: ~150 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { SessionNote } from '../../utils/SessionCoordinator.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const saveSessionNoteTool: Tool = {
  name: 'save_session_note',
  description:
    'Save a decision, hypothesis, blocker, learning, or pattern to session memory. Indexed immediately for fast retrieval.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['decision', 'hypothesis', 'blocker', 'learning', 'pattern'],
        description: 'Type of note',
      },
      content: {
        type: 'string',
        description: 'Note content',
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata (e.g., confidence, severity, alternatives)',
      },
    },
    required: ['type', 'content'],
  },
};

interface SaveNoteInput {
  type: SessionNote['type'];
  content: string;
  metadata?: Record<string, any>;
}

interface SaveNoteOutput {
  success: boolean;
  data?: {
    type: string;
    content: string;
    saved: boolean;
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
 * Handler for saveSessionNote tool
 */
export async function saveSessionNoteHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as SaveNoteInput;

    if (!input.type) {
      throw new Error('type is required');
    }

    if (!input.content) {
      throw new Error('content is required');
    }

    const result = await saveNote(input);

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

    const errorResult: SaveNoteOutput = {
      success: false,
      error: {
        code: 'SAVE_NOTE_ERROR',
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
 * Core save note logic
 */
async function saveNote(input: SaveNoteInput): Promise<SaveNoteOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const note: SessionNote = {
      type: input.type,
      content: input.content,
      metadata: input.metadata,
    };

    await coordinator.saveNote(note);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        type: input.type,
        content: input.content,
        saved: true,
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
        code: 'SAVE_NOTE_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
