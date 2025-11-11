/**
 * PatternIndexer - Dual-index patterns to Qdrant + Google File Search
 *
 * Part of ADR-007 Week 3: Hybrid Pattern Library
 *
 * Responsibilities:
 * - Index patterns to Qdrant (fast similarity search, 50-200ms)
 * - Index patterns to Google FS (comprehensive generative search, 5-10s)
 * - Track pattern usage counts
 * - Handle pattern promotion workflow
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs/promises';
import OpenAI from 'openai';

export interface PatternMetadata {
  id: string;
  name: string;
  category: string;
  quality: number;
  usageCount: number;
  lastUsed?: string;
  created: string;
  tags: string[];
  description: string;
  filePath: string;
  verified?: boolean;
}

export interface IndexingResult {
  success: boolean;
  qdrantIndexed: boolean;
  googleFsIndexed: boolean;
  duration: number;
  error?: string;
}

/**
 * PatternIndexer class for dual-indexing patterns
 */
export class PatternIndexer {
  private qdrant: QdrantClient;
  private openai: OpenAI;
  private collectionName = 'shared_patterns';

  constructor() {
    // Initialize Qdrant client
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    // Initialize OpenAI for embeddings
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Initialize Qdrant collection for patterns
   */
  async initializeQdrantCollection(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.qdrant.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        // Create collection with text-embedding-3-small dimensions (1536)
        await this.qdrant.createCollection(this.collectionName, {
          vectors: {
            size: 1536,
            distance: 'Cosine',
          },
        });

        // Create payload indexes for filtering
        await this.qdrant.createPayloadIndex(this.collectionName, {
          field_name: 'category',
          field_schema: 'keyword',
        });

        await this.qdrant.createPayloadIndex(this.collectionName, {
          field_name: 'verified',
          field_schema: 'bool',
        });

        await this.qdrant.createPayloadIndex(this.collectionName, {
          field_name: 'usage_count',
          field_schema: 'integer',
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize Qdrant collection: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate embedding for pattern content
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }

    return embedding;
  }

  /**
   * Index a single pattern to Qdrant
   */
  async indexToQdrant(pattern: PatternMetadata, content: string): Promise<boolean> {
    try {
      // Generate embedding from pattern content
      const embeddingText = `${pattern.name}\n${pattern.description}\n${content}`;
      const embedding = await this.generateEmbedding(embeddingText);

      // Upsert to Qdrant
      await this.qdrant.upsert(this.collectionName, {
        points: [
          {
            id: pattern.id,
            vector: embedding,
            payload: {
              name: pattern.name,
              category: pattern.category,
              quality: pattern.quality,
              usage_count: pattern.usageCount,
              last_used: pattern.lastUsed,
              created: pattern.created,
              tags: pattern.tags,
              description: pattern.description,
              file_path: pattern.filePath,
              verified: pattern.verified || false,
            },
          },
        ],
      });

      return true;
    } catch (error) {
      console.error(`Failed to index pattern ${pattern.id} to Qdrant:`, error);
      return false;
    }
  }

  /**
   * Index a single pattern to Google File Search
   * TODO: Implement Google FS indexing (requires Google AI SDK)
   */
  async indexToGoogleFS(_pattern: PatternMetadata, _content: string): Promise<boolean> {
    // Placeholder: Google FS indexing not yet implemented
    // Will be added after Week 2 integration is tested
    return true;
  }

  /**
   * Index a pattern to both Qdrant and Google FS
   */
  async indexPattern(pattern: PatternMetadata): Promise<IndexingResult> {
    const startTime = Date.now();

    try {
      // Read pattern content
      const content = await fs.readFile(pattern.filePath, 'utf-8');

      // Index to both systems in parallel
      const [qdrantResult, googleFsResult] = await Promise.all([
        this.indexToQdrant(pattern, content),
        this.indexToGoogleFS(pattern, content),
      ]);

      const duration = Date.now() - startTime;

      return {
        success: qdrantResult && googleFsResult,
        qdrantIndexed: qdrantResult,
        googleFsIndexed: googleFsResult,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        qdrantIndexed: false,
        googleFsIndexed: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Search patterns in Qdrant (fast mode)
   */
  async searchFast(
    query: string,
    options?: {
      category?: string;
      minQuality?: number;
      verifiedOnly?: boolean;
      limit?: number;
    }
  ): Promise<PatternMetadata[]> {
    try {
      // Generate query embedding
      const embedding = await this.generateEmbedding(query);

      // Build filter
      const filter: any = {};
      if (options?.category) {
        filter.category = options.category;
      }
      if (options?.minQuality !== undefined) {
        filter.quality = { $gte: options.minQuality };
      }
      if (options?.verifiedOnly) {
        filter.verified = true;
      }

      // Search Qdrant
      const results = await this.qdrant.search(this.collectionName, {
        vector: embedding,
        filter: Object.keys(filter).length > 0 ? { must: [{ key: 'payload', match: filter }] } : undefined,
        limit: options?.limit || 10,
      });

      // Convert to PatternMetadata
      return results.map((result) => ({
        id: result.id as string,
        name: result.payload?.name as string,
        category: result.payload?.category as string,
        quality: result.payload?.quality as number,
        usageCount: result.payload?.usage_count as number,
        lastUsed: result.payload?.last_used as string | undefined,
        created: result.payload?.created as string,
        tags: result.payload?.tags as string[],
        description: result.payload?.description as string,
        filePath: result.payload?.file_path as string,
        verified: result.payload?.verified as boolean,
      }));
    } catch (error) {
      console.error('Fast search failed:', error);
      return [];
    }
  }

  /**
   * Track pattern usage
   */
  async trackUsage(patternId: string): Promise<void> {
    try {
      // Get current pattern from Qdrant
      const result = await this.qdrant.retrieve(this.collectionName, {
        ids: [patternId],
      });

      if (result.length === 0) {
        throw new Error(`Pattern ${patternId} not found`);
      }

      const pattern = result[0];
      if (!pattern || !pattern.payload) {
        throw new Error(`Pattern ${patternId} has no payload`);
      }

      const currentUsageCount = (pattern.payload.usage_count as number | undefined) || 0;
      const newUsageCount = currentUsageCount + 1;

      // Update usage count and last used timestamp
      await this.qdrant.setPayload(this.collectionName, {
        points: [patternId],
        payload: {
          usage_count: newUsageCount,
          last_used: new Date().toISOString(),
        },
      });

      // Check if pattern should be promoted
      if (newUsageCount >= 3 && !pattern.payload?.verified) {
        await this.promotePattern(patternId);
      }
    } catch (error) {
      console.error(`Failed to track usage for pattern ${patternId}:`, error);
    }
  }

  /**
   * Promote pattern to "Verified" status
   */
  async promotePattern(patternId: string): Promise<void> {
    try {
      await this.qdrant.setPayload(this.collectionName, {
        points: [patternId],
        payload: {
          verified: true,
        },
      });

      console.log(`✅ Pattern ${patternId} promoted to VERIFIED (usage_count >= 3)`);
    } catch (error) {
      console.error(`Failed to promote pattern ${patternId}:`, error);
    }
  }

  /**
   * Get pattern statistics
   */
  async getStats(): Promise<{
    totalPatterns: number;
    verifiedPatterns: number;
    categoryCounts: Record<string, number>;
    averageQuality: number;
  }> {
    try {
      // Get all patterns
      const scroll = await this.qdrant.scroll(this.collectionName, {
        limit: 1000,
      });

      const patterns = scroll.points;
      const totalPatterns = patterns.length;
      const verifiedPatterns = patterns.filter((p) => p.payload?.verified).length;

      // Count by category
      const categoryCounts: Record<string, number> = {};
      let qualitySum = 0;

      for (const pattern of patterns) {
        const category = pattern.payload?.category as string;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        qualitySum += (pattern.payload?.quality as number) || 0;
      }

      return {
        totalPatterns,
        verifiedPatterns,
        categoryCounts,
        averageQuality: totalPatterns > 0 ? qualitySum / totalPatterns : 0,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalPatterns: 0,
        verifiedPatterns: 0,
        categoryCounts: {},
        averageQuality: 0,
      };
    }
  }
}
