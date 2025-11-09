/**
 * extractSessionMemories Tool
 *
 * Extract all valuable memories from the current session.
 * Use this during finalization to include session insights in the finalization pack.
 *
 * Token usage: ~200 tokens
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getActiveCoordinator } from './startSessionCoordination.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const extractSessionMemoriesTool: Tool = {
  name: 'extract_session_memories',
  description:
    'Extract all valuable memories from the current session. Use this during finalization to include session insights in the finalization pack.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

interface ExtractMemoriesOutput {
  success: boolean;
  data?: {
    totalMemories: number;
    memories: Array<{
      type: string;
      content: string;
      timestamp: string;
    }>;
    formatted: string;
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
 * Handler for extractSessionMemories tool
 */
export async function extractSessionMemoriesHandler(
  _args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const result = await extractMemories();

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

    const errorResult: ExtractMemoriesOutput = {
      success: false,
      error: {
        code: 'EXTRACT_MEMORIES_ERROR',
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
 * Core extract memories logic
 */
async function extractMemories(): Promise<ExtractMemoriesOutput> {
  const startTime = Date.now();

  try {
    const coordinator = getActiveCoordinator();

    const memories = await coordinator.extractValuableMemories();

    // Format as markdown for easy inclusion in finalization pack
    const formatted = formatMemoriesAsMarkdown(memories);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON({ memories, formatted });
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        totalMemories: memories.length,
        memories: memories.map(m => ({
          type: m.type,
          content: m.content,
          timestamp: m.timestamp,
        })),
        formatted,
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
        code: 'EXTRACT_MEMORIES_ERROR',
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
 * Format memories as markdown
 */
function formatMemoriesAsMarkdown(
  memories: Array<{ type: string; content: string; timestamp: string }>
): string {
  if (memories.length === 0) {
    return '## Session Memories\n\nNo memories recorded during this session.';
  }

  const grouped: Record<string, Array<{ content: string; timestamp: string }>> = {};

  // Group by type
  for (const memory of memories) {
    if (!grouped[memory.type]) {
      grouped[memory.type] = [];
    }
    grouped[memory.type]!.push({
      content: memory.content,
      timestamp: memory.timestamp,
    });
  }

  let markdown = '## Session Memories\n\n';

  // Format each type
  const typeLabels: Record<string, string> = {
    decision: '### Key Decisions',
    hypothesis: '### Working Hypotheses',
    blocker: '### Blockers & Open Questions',
    learning: '### Learnings & Insights',
    pattern: '### Patterns Identified',
  };

  for (const [type, items] of Object.entries(grouped)) {
    const label = typeLabels[type] || `### ${type && type.charAt(0).toUpperCase() + type.slice(1)}s`;
    markdown += `${label} (${items.length})\n\n`;

    for (const item of items) {
      markdown += `- ${item.content}\n`;
    }

    markdown += '\n';
  }

  return markdown;
}
