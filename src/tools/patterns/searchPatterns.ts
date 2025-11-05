/**
 * searchPatterns Tool
 *
 * Searches the pattern library by keyword and category.
 * Implements progressive disclosure pattern - returns metadata only,
 * allowing agents to load full patterns on demand.
 *
 * Token savings: ~100-500 tokens vs loading all patterns upfront
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getPatternCategories,
  searchPatternsInCategory,
  PatternMetadata,
} from '../../utils/filesystem.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const searchPatternsTool: Tool = {
  name: 'searchPatterns',
  description:
    'Search pattern library by keyword and category. Returns pattern metadata for progressive loading.',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Keyword to search for in pattern names and descriptions',
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
      includeExecutable: {
        type: 'boolean',
        description: 'Only return patterns with executable implementations',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 20,
      },
    },
  },
};

interface SearchPatternsInput {
  keyword?: string;
  category?: string;
  includeExecutable?: boolean;
  limit?: number;
}

interface SearchPatternsOutput {
  success: boolean;
  data?: PatternMetadata[];
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
 * Handler for searchPatterns tool
 */
export async function searchPatternsHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    // Validate and parse input
    const input = args as SearchPatternsInput;
    const result = await searchPatterns(input);

    // Format response for MCP
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

    const errorResult: SearchPatternsOutput = {
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
 * Core search logic
 */
async function searchPatterns(input: SearchPatternsInput): Promise<SearchPatternsOutput> {
  const startTime = Date.now();

  try {
    let allPatterns: PatternMetadata[] = [];

    // Get categories to search
    const categoriesToSearch = input.category
      ? [input.category]
      : await getPatternCategories();

    // Search each category
    for (const category of categoriesToSearch) {
      const patterns = await searchPatternsInCategory(
        category,
        input.keyword,
        input.includeExecutable
      );
      allPatterns = allPatterns.concat(patterns);
    }

    // Sort by quality score (descending), then name
    allPatterns.sort((a, b) => {
      if (a.quality !== undefined && b.quality !== undefined) {
        if (a.quality !== b.quality) {
          return b.quality - a.quality;
        }
      }
      return a.name.localeCompare(b.name);
    });

    // Apply limit
    const limit = input.limit ?? 20;
    const limitedPatterns = allPatterns.slice(0, limit);

    // Calculate token usage
    const tokensUsed = estimateTokensFromJSON(limitedPatterns);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: limitedPatterns,
      metadata: {
        tokensUsed,
        resultsCount: limitedPatterns.length,
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
