/**
 * indexPatternLibrary Tool
 *
 * Index all patterns from ~/.shared-patterns/patterns/ to both:
 * - Qdrant (fast similarity search)
 * - Google File Search (comprehensive search)
 *
 * Part of ADR-007 Week 3: Hybrid Pattern Library
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PatternIndexer, PatternMetadata } from '../../utils/PatternIndexer.js';
import { getPatternsBasePath, getPatternCategories } from '../../utils/filesystem.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Tool definition for MCP
 */
export const indexPatternLibraryTool: Tool = {
  name: 'indexPatternLibrary',
  description:
    'Index all patterns from shared library to Qdrant + Google FS. Run this after adding new patterns.',
  inputSchema: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description: 'Force re-indexing even if already indexed',
        default: false,
      },
      category: {
        type: 'string',
        description: 'Only index patterns from specific category (optional)',
      },
    },
  },
};

interface IndexLibraryInput {
  force?: boolean;
  category?: string;
}

interface IndexLibraryOutput {
  success: boolean;
  data?: {
    totalPatterns: number;
    indexed: number;
    skipped: number;
    failed: number;
    categories: Record<string, number>;
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
 * Handler for indexPatternLibrary tool
 */
export async function indexPatternLibraryHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    const input = args as IndexLibraryInput;
    const result = await indexPatternLibrary(input);

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

    const errorResult: IndexLibraryOutput = {
      success: false,
      error: {
        code: 'INDEXING_ERROR',
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
 * Core indexing logic
 */
async function indexPatternLibrary(input: IndexLibraryInput): Promise<IndexLibraryOutput> {
  const startTime = Date.now();

  try {
    const indexer = new PatternIndexer();
    await indexer.initializeQdrantCollection();

    // Get categories to index
    const allCategories = await getPatternCategories();
    const categoriesToIndex = input.category ? [input.category] : allCategories;

    let totalPatterns = 0;
    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    const categoryCounts: Record<string, number> = {};

    for (const category of categoriesToIndex) {
      const categoryPath = path.join(getPatternsBasePath(), category);

      try {
        const entries = await fs.readdir(categoryPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            totalPatterns++;

            const baseName = entry.name.replace('.md', '');
            const filePath = path.join(categoryPath, entry.name);

            // Read pattern metadata from frontmatter or content
            const content = await fs.readFile(filePath, 'utf-8');
            const metadata = await extractPatternMetadata(
              category,
              baseName,
              filePath,
              content
            );

            // Index pattern
            const result = await indexer.indexPattern(metadata);

            if (result.success) {
              indexed++;
              categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            } else {
              failed++;
              console.error(`Failed to index ${metadata.id}:`, result.error);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to index category ${category}:`, error);
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        totalPatterns,
        indexed,
        skipped,
        failed,
        categories: categoryCounts,
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
        code: 'INDEXING_ERROR',
        message: errorMessage,
      },
      metadata: {
        duration,
      },
    };
  }
}

/**
 * Extract pattern metadata from file
 */
async function extractPatternMetadata(
  category: string,
  baseName: string,
  filePath: string,
  content: string
): Promise<PatternMetadata> {
  // Parse frontmatter (YAML between --- markers)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, any> = {};

  if (frontmatterMatch && frontmatterMatch[1]) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        // Handle arrays in YAML
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key.trim()] = value
            .slice(1, -1)
            .split(',')
            .map((v) => v.trim());
        } else {
          frontmatter[key.trim()] = value;
        }
      }
    }
  }

  // Extract description (first paragraph after frontmatter)
  const descriptionMatch = content
    .replace(/^---[\s\S]*?---/, '')
    .match(/##\s+Problem\s+([\s\S]*?)(?=\n##|$)/);
  let description = '';
  if (descriptionMatch && descriptionMatch[1]) {
    description = descriptionMatch[1].trim().substring(0, 200);
  }

  return {
    id: frontmatter.id || `${category}/${baseName}`,
    name: baseName,
    category: frontmatter.category || category,
    quality: parseFloat(frontmatter.quality_score) || 0,
    usageCount: 0, // Initialize to 0
    created: frontmatter.created || new Date().toISOString().split('T')[0],
    tags: frontmatter.tags || [],
    description: description || frontmatter.description || '',
    filePath,
    verified: false,
  };
}
