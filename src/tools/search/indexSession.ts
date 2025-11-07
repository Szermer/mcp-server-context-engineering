/**
 * indexSession Tool
 *
 * Indexes a session's artifacts to Google File Search for semantic search.
 * Creates or updates the File Search store with session metadata.
 *
 * Token savings: Enables future semantic queries on indexed content
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Tool definition for MCP
 */
export const indexSessionTool: Tool = {
  name: 'indexSession',
  description:
    'Index a session to Google File Search for semantic search. Creates embeddings from finalization pack and session summary.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to project directory (e.g., ~/Dev/PrivateLanguage)',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID to index (e.g., 2025-11-07)',
      },
      force: {
        type: 'boolean',
        description: 'Force re-indexing even if already indexed',
        default: false,
      },
    },
    required: ['projectPath', 'sessionId'],
  },
};

interface IndexSessionInput {
  projectPath: string;
  sessionId: string;
  force?: boolean;
}

interface IndexSessionOutput {
  success: boolean;
  data?: {
    filesIndexed: number;
    tokensIndexed: number;
    cost: number;
  };
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    duration: number;
  };
}

/**
 * Handler for indexSession tool
 */
export async function indexSessionHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as IndexSessionInput;
    const result = await indexSession(input);

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

    const errorResult: IndexSessionOutput = {
      success: false,
      error: {
        code: 'INDEX_ERROR',
        message: errorMessage,
      },
      metadata: {
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
 * Helper to wait for operation completion
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core indexing logic
 */
async function indexSession(input: IndexSessionInput): Promise<IndexSessionOutput> {
  const startTime = Date.now();

  try {
    // Expand tilde in project path
    const projectPath = input.projectPath.replace(/^~/, homedir());

    // Load project config
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

    // Find or create file search store
    const storesResponse = await ai.fileSearchStores.list();
    const stores: any[] = [];
    for await (const store of storesResponse) {
      stores.push(store);
    }

    let store = stores.find((s: any) => s.displayName === config.store_name);

    if (!store) {
      // Create new store
      const newStore = await ai.fileSearchStores.create({
        config: { displayName: config.store_name },
      });
      store = newStore;
    }

    // Load session files
    const sessionDir = join(projectPath, '.agent-artifacts', input.sessionId);
    const finalizationPath = join(sessionDir, 'finalization-pack.json');
    const summaryPath = join(sessionDir, 'session-summary.md');

    const finalizationContent = await readFile(finalizationPath, 'utf-8');
    const summaryContent = await readFile(summaryPath, 'utf-8');

    const finalization = JSON.parse(finalizationContent);

    // Extract metadata
    const customMetadata = {
      session_id: input.sessionId,
      session_type: finalization.summary?.sessionType || 'development',
      impact: finalization.summary?.impact || 'medium',
    };

    let filesIndexed = 0;
    let tokensIndexed = 0;

    // Upload finalization pack
    let op = await ai.fileSearchStores.uploadToFileSearchStore({
      file: new Blob([finalizationContent], { type: 'application/json' }),
      fileSearchStoreName: store.name,
      config: {
        displayName: `${input.sessionId}-finalization-pack.json`,
        customMetadata: customMetadata as any,
        mimeType: 'application/json',
      },
    });

    while (!op.done) {
      await delay(3000);
      op = await ai.operations.get({ operation: op });
    }

    filesIndexed++;
    tokensIndexed += Math.ceil(finalizationContent.length / 4);

    // Upload session summary
    op = await ai.fileSearchStores.uploadToFileSearchStore({
      file: new Blob([summaryContent], { type: 'text/markdown' }),
      fileSearchStoreName: store.name,
      config: {
        displayName: `${input.sessionId}-session-summary.md`,
        customMetadata: customMetadata as any,
        mimeType: 'text/markdown',
      },
    });

    while (!op.done) {
      await delay(3000);
      op = await ai.operations.get({ operation: op });
    }

    filesIndexed++;
    tokensIndexed += Math.ceil(summaryContent.length / 4);

    // Calculate cost ($0.15 per 1M tokens)
    const cost = (tokensIndexed / 1_000_000) * 0.15;

    // Update config stats
    config.stats.total_files_indexed += filesIndexed;
    config.stats.total_tokens_indexed += tokensIndexed;
    config.stats.total_cost_usd += cost;
    config.stats.last_indexed = new Date().toISOString();

    await writeFile(configPath, JSON.stringify(config, null, 2));

    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        filesIndexed,
        tokensIndexed,
        cost,
      },
      metadata: {
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: {
        code: 'INDEX_ERROR',
        message: errorMessage,
      },
      metadata: {
        duration,
      },
    };
  }
}
