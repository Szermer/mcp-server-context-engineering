/**
 * getSearchStats Tool
 *
 * Retrieves statistics about Google File Search usage for a project.
 * Shows indexing costs, token usage, and file counts.
 *
 * Token savings: Minimal - just returns config stats
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const getSearchStatsTool: Tool = {
  name: 'getSearchStats',
  description:
    'Get Google File Search statistics for a project. Shows indexing costs, token usage, and file counts.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to project directory (e.g., ~/Dev/PrivateLanguage)',
      },
    },
    required: ['projectPath'],
  },
};

interface GetSearchStatsInput {
  projectPath: string;
}

interface GetSearchStatsOutput {
  success: boolean;
  data?: {
    enabled: boolean;
    storeName: string;
    autoIndex: boolean;
    stats: {
      totalFilesIndexed: number;
      totalTokensIndexed: number;
      totalCostUsd: number;
      lastIndexed: string;
    };
    chunking: {
      maxTokensPerChunk: number;
      maxOverlapTokens: number;
    };
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
 * Handler for getSearchStats tool
 */
export async function getSearchStatsHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as GetSearchStatsInput;
    const result = await getSearchStats(input);

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

    const errorResult: GetSearchStatsOutput = {
      success: false,
      error: {
        code: 'STATS_ERROR',
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
 * Core stats retrieval logic
 */
async function getSearchStats(input: GetSearchStatsInput): Promise<GetSearchStatsOutput> {
  const startTime = Date.now();

  try {
    // Expand tilde in project path
    const projectPath = input.projectPath.replace(/^~/, homedir());

    // Load project config
    const configPath = join(projectPath, '.gemini-config.json');
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    const result = {
      enabled: config.enabled,
      storeName: config.store_name,
      autoIndex: config.auto_index,
      stats: {
        totalFilesIndexed: config.stats.total_files_indexed,
        totalTokensIndexed: config.stats.total_tokens_indexed,
        totalCostUsd: config.stats.total_cost_usd,
        lastIndexed: config.stats.last_indexed,
      },
      chunking: {
        maxTokensPerChunk: config.chunking.max_tokens_per_chunk,
        maxOverlapTokens: config.chunking.max_overlap_tokens,
      },
    };

    const tokensUsed = estimateTokensFromJSON(result);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: result,
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
        code: 'STATS_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        duration,
      },
    };
  }
}
