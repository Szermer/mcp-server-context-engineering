/**
 * getSessionCode Tool
 *
 * Extracts executable code blocks from session artifacts.
 * Filters by programming language if specified.
 *
 * Token usage: ~500-1500 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { extractSessionCode } from '../../utils/artifacts.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getSessionCodeTool: Tool = {
  name: 'getSessionCode',
  description:
    'Extract executable code blocks from session artifacts. Filter by programming language.',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name (e.g., "PrivateLanguage")',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID (e.g., "2025-10-15-authentication-flow")',
      },
      language: {
        type: 'string',
        description:
          'Filter by programming language (e.g., "typescript", "python", "sql")',
      },
    },
    required: ['project', 'sessionId'],
  },
};

interface GetSessionCodeInput {
  project: string;
  sessionId: string;
  language?: string;
}

interface GetSessionCodeOutput {
  success: boolean;
  data?: Array<{
    language: string;
    code: string;
    file?: string;
  }>;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    codeBlocksCount: number;
    duration: number;
  };
}

/**
 * Handler for getSessionCode tool
 */
export async function getSessionCodeHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as GetSessionCodeInput;

    if (!input.project) {
      throw new Error('project is required');
    }

    if (!input.sessionId) {
      throw new Error('sessionId is required');
    }

    const result = await getSessionCode(input);

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

    const errorResult: GetSessionCodeOutput = {
      success: false,
      error: {
        code: 'EXTRACTION_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        codeBlocksCount: 0,
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
 * Core extraction logic
 */
async function getSessionCode(
  input: GetSessionCodeInput
): Promise<GetSessionCodeOutput> {
  const startTime = Date.now();

  try {
    const codeBlocks = await extractSessionCode(
      input.project,
      input.sessionId,
      input.language
    );

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON(codeBlocks);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: codeBlocks,
      metadata: {
        tokensUsed,
        codeBlocksCount: codeBlocks.length,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'EXTRACTION_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        codeBlocksCount: 0,
        duration,
      },
    };
  }
}
