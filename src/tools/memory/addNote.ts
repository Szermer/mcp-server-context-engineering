/**
 * addNote Tool
 *
 * Adds a decision, hypothesis, blocker, or general note to session memory.
 * Used during active development to track important information.
 *
 * Token usage: ~50 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { addMemoryNote, NoteType } from '../../utils/memory.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const addNoteTool: Tool = {
  name: 'addNote',
  description:
    'Add a decision, hypothesis, blocker, or general note to session memory for current project.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to project directory (e.g., "/Users/username/Dev/PrivateLanguage")',
      },
      type: {
        type: 'string',
        enum: ['decision', 'hypothesis', 'blocker', 'general'],
        description: 'Type of note to add',
      },
      content: {
        type: 'string',
        description: 'Note content',
      },
    },
    required: ['projectPath', 'type', 'content'],
  },
};

interface AddNoteInput {
  projectPath: string;
  type: NoteType;
  content: string;
}

interface AddNoteOutput {
  success: boolean;
  data?: {
    type: NoteType;
    content: string;
    timestamp: string;
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
 * Handler for addNote tool
 */
export async function addNoteHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as AddNoteInput;

    if (!input.projectPath) {
      throw new Error('projectPath is required');
    }

    if (!input.type) {
      throw new Error('type is required');
    }

    if (!input.content) {
      throw new Error('content is required');
    }

    const result = await addNote(input);

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

    const errorResult: AddNoteOutput = {
      success: false,
      error: {
        code: 'ADD_NOTE_ERROR',
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
 * Core add note logic
 */
async function addNote(input: AddNoteInput): Promise<AddNoteOutput> {
  const startTime = Date.now();

  try {
    const note = await addMemoryNote(input.projectPath, input.type, input.content);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ input, note });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: note,
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
        code: 'ADD_NOTE_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
