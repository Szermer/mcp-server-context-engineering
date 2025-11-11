/**
 * findPatterns Tool
 *
 * Intelligent pattern search with dual-indexing support.
 * Routes queries to Qdrant (fast, 50-200ms) or Google FS (comprehensive, 5-10s)
 * based on search mode.
 *
 * Part of ADR-007 Week 3: Hybrid Pattern Library
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PatternIndexer, PatternMetadata } from '../../utils/PatternIndexer.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const findPatternsTool: Tool = {
  name: 'findPatterns',
  description:
    'Search pattern library with intelligent routing. Use "fast" mode for quick similarity search (Qdrant, 50-200ms) or "comprehensive" mode for deep generative search (Google FS, 5-10s).',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query describing the pattern you need',
      },
      mode: {
        type: 'string',
        description: 'Search mode: "fast" (Qdrant) or "comprehensive" (Google FS)',
        enum: ['fast', 'comprehensive'],
        default: 'fast',
      },
      category: {
        type: 'string',
        description:
          'Filter by category: database, security, ui, backend, testing, architecture, mcp-integration',
        enum: [
          'database',
          'security',
          'ui',
          'backend',
          'testing',
          'architecture',
          'mcp-integration',
        ],
      },
      minQuality: {
        type: 'number',
        description: 'Minimum quality score (0-10)',
        minimum: 0,
        maximum: 10,
      },
      verifiedOnly: {
        type: 'boolean',
        description: 'Only return verified patterns (usage_count >= 3)',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 10,
        minimum: 1,
        maximum: 50,
      },
    },
    required: ['query'],
  },
};

interface FindPatternsInput {
  query: string;
  mode?: 'fast' | 'comprehensive';
  category?: string;
  minQuality?: number;
  verifiedOnly?: boolean;
  limit?: number;
}

interface FindPatternsOutput {
  success: boolean;
  data?: {
    patterns: PatternMetadata[];
    searchMode: string;
    routingReason?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    resultsCount: number;
    duration: number;
  };
}

/**
 * Handler for findPatterns tool
 */
export async function findPatternsHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as FindPatternsInput;
    const result = await findPatterns(input);

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

    const errorResult: FindPatternsOutput = {
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        resultsCount: 0,
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
 * Core search logic with intelligent routing
 */
async function findPatterns(input: FindPatternsInput): Promise<FindPatternsOutput> {
  const startTime = Date.now();

  try {
    // Initialize pattern indexer
    const indexer = new PatternIndexer();

    // Ensure Qdrant collection exists
    await indexer.initializeQdrantCollection();

    // Determine search mode
    const mode = input.mode || 'fast';

    let patterns: PatternMetadata[] = [];
    let routingReason: string | undefined;

    if (mode === 'fast') {
      // Fast mode: Use Qdrant
      patterns = await indexer.searchFast(input.query, {
        category: input.category,
        minQuality: input.minQuality,
        verifiedOnly: input.verifiedOnly,
        limit: input.limit || 10,
      });

      routingReason = 'Using Qdrant for fast similarity search (50-200ms)';
    } else {
      // Comprehensive mode: Use Google FS (to be implemented)
      // For now, fall back to Qdrant with a note
      patterns = await indexer.searchFast(input.query, {
        category: input.category,
        minQuality: input.minQuality,
        verifiedOnly: input.verifiedOnly,
        limit: input.limit || 10,
      });

      routingReason =
        'Comprehensive mode (Google FS) not yet implemented - using Qdrant as fallback';
    }

    const duration = Date.now() - startTime;
    const tokensUsed = estimateTokensFromJSON(patterns);

    return {
      success: true,
      data: {
        patterns,
        searchMode: mode,
        routingReason,
      },
      metadata: {
        tokensUsed,
        resultsCount: patterns.length,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        resultsCount: 0,
        duration,
      },
    };
  }
}
