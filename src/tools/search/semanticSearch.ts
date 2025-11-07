/**
 * semanticSearch Tool
 *
 * Searches session artifacts using Google File Search semantic understanding.
 * Enables conceptual queries that understand meaning beyond keyword matching.
 *
 * Token savings: Finds relevant sessions grep would miss
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenAI } from '@google/genai';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Tool definition for MCP
 */
export const semanticSearchTool: Tool = {
  name: 'semanticSearch',
  description:
    'Search session artifacts using Google File Search semantic understanding. Finds conceptually related sessions beyond keyword matching.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Semantic query describing what you want to find',
      },
      projectPath: {
        type: 'string',
        description: 'Path to project directory (e.g., ~/Dev/PrivateLanguage)',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 5,
      },
    },
    required: ['query', 'projectPath'],
  },
};

interface SemanticSearchInput {
  query: string;
  projectPath: string;
  maxResults?: number;
}

// Use any for grounding chunks to avoid type conflicts
type GroundingChunkData = any;

interface SemanticSearchOutput {
  success: boolean;
  data?: {
    answer: string;
    citations: Array<{
      source: string;
      title?: string;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    citationCount: number;
    duration: number;
    queryTime: number;
  };
}

/**
 * Handler for semanticSearch tool
 */
export async function semanticSearchHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as SemanticSearchInput;
    const result = await semanticSearch(input);

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

    const errorResult: SemanticSearchOutput = {
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        citationCount: 0,
        duration,
        queryTime: 0,
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
 * Core semantic search logic
 */
async function semanticSearch(input: SemanticSearchInput): Promise<SemanticSearchOutput> {
  const startTime = Date.now();
  const queryStartTime = Date.now();

  try {
    // Expand tilde in project path
    const projectPath = input.projectPath.replace(/^~/, homedir());

    // Load project config to get store name
    const configPath = join(projectPath, '.gemini-config.json');
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    if (!config.enabled) {
      throw new Error('Google File Search is not enabled in project config');
    }

    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Find the file search store
    const storesResponse = await ai.fileSearchStores.list();
    const stores: any[] = [];
    for await (const store of storesResponse) {
      stores.push(store);
    }

    const store = stores.find((s: any) => s.displayName === config.store_name);
    if (!store) {
      throw new Error(`File Search store "${config.store_name}" not found. Run indexing first.`);
    }

    // Execute semantic search query
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the provided session artifacts, answer: ${input.query}`,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [store.name],
            },
          },
        ],
      },
    });

    const queryTime = Date.now() - queryStartTime;

    // Extract answer and citations
    const answer = response.text || 'No results found';
    const groundingChunks: GroundingChunkData[] =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const citations = groundingChunks
      .map((chunk: GroundingChunkData) => ({
        source: chunk.uri || 'unknown',
        title: chunk.title,
      }))
      .slice(0, input.maxResults || 5);

    const result = {
      answer,
      citations,
    };

    const tokensUsed = estimateTokensFromJSON(result);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data: result,
      metadata: {
        tokensUsed,
        citationCount: citations.length,
        duration,
        queryTime,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const queryTime = Date.now() - queryStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: errorMessage,
      },
      metadata: {
        tokensUsed: 0,
        citationCount: 0,
        duration,
        queryTime,
      },
    };
  }
}
