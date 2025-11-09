/**
 * SessionCoordinator - Manages ephemeral session memory using Qdrant Cloud
 *
 * Provides real-time coordination during ClaudeDev sessions:
 * - Save decisions, hypotheses, blockers
 * - Fast semantic search (50-200ms)
 * - Duplicate detection
 * - Automatic cleanup on finalize
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAI } from 'openai';

export interface SessionNote {
  type: 'decision' | 'hypothesis' | 'blocker' | 'learning' | 'pattern';
  content: string;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  score: number;
  type: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class SessionCoordinator {
  private qdrant: QdrantClient;
  private openai: OpenAI;
  private sessionId: string;
  private projectPath: string;
  private collectionName: string;

  constructor(sessionId: string, projectPath: string) {
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!qdrantUrl || !qdrantApiKey) {
      throw new Error('Missing QDRANT_URL or QDRANT_API_KEY environment variables');
    }

    if (!openaiApiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }

    this.sessionId = sessionId;
    this.projectPath = projectPath;

    // Use project-specific collection name to isolate sessions
    const projectName = projectPath.split('/').pop() || 'default';
    this.collectionName = `session-${projectName}-${sessionId}`;

    // Initialize Qdrant Cloud client
    this.qdrant = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });

    // Initialize OpenAI client
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Initialize session memory collection
   */
  async initialize(): Promise<void> {
    try {
      // Check if collection already exists
      const collections = await this.qdrant.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (exists) {
        console.error(`📦 Session collection already exists: ${this.collectionName}`);
        return;
      }

      // Create ephemeral collection for this session
      await this.qdrant.createCollection(this.collectionName, {
        vectors: {
          size: 3072, // text-embedding-3-large dimension
          distance: 'Cosine'
        }
      });

      console.error(`✅ Session collection created: ${this.collectionName}`);

      // Optionally seed with relevant past knowledge
      await this.seedFromArchive();

    } catch (error: any) {
      console.error(`❌ Failed to initialize session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Seed session with relevant knowledge from past sessions
   * This loads context from Google File Search into Qdrant for fast access
   */
  private async seedFromArchive(): Promise<void> {
    console.error('🌱 Seeding session with past knowledge...');

    // TODO: Query Google File Search for recent relevant sessions
    // TODO: Index top results into Qdrant for fast lookup

    console.error('   (Seeding not yet implemented - will add in Week 2)');
  }

  /**
   * Save a note to session memory
   */
  async saveNote(note: SessionNote): Promise<void> {
    try {
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(note.content);

      // Create numeric point ID (required by Qdrant)
      // Use timestamp + random number to ensure uniqueness
      const pointId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

      // Store in Qdrant
      await this.qdrant.upsert(this.collectionName, {
        points: [{
          id: pointId,
          vector: embedding,
          payload: {
            type: note.type,
            content: note.content,
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            project_path: this.projectPath,
            ...note.metadata
          }
        }]
      });

      console.error(`📝 Saved ${note.type}: ${note.content.slice(0, 60)}${note.content.length > 60 ? '...' : ''}`);

    } catch (error: any) {
      console.error(`❌ Failed to save note: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search session memory
   */
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      // Generate embedding for query
      const embedding = await this.generateEmbedding(query);

      // Search in Qdrant
      const results = await this.qdrant.search(this.collectionName, {
        vector: embedding,
        limit,
        with_payload: true
      });

      // Format results
      return results.map(r => ({
        score: r.score || 0,
        type: r.payload?.type as string || 'unknown',
        content: r.payload?.content as string || '',
        timestamp: r.payload?.timestamp as string || '',
        metadata: r.payload as Record<string, any>
      }));

    } catch (error: any) {
      console.error(`❌ Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if similar work already exists (duplicate detection)
   */
  async checkDuplicate(description: string, threshold: number = 0.75): Promise<SearchResult[]> {
    const results = await this.search(description, 5);

    // Filter by similarity threshold
    const duplicates = results.filter(r => r.score >= threshold);

    if (duplicates.length > 0) {
      console.error(`⚠️  Found ${duplicates.length} potential duplicate(s):`);
      duplicates.forEach((dup, i) => {
        console.error(`   ${i + 1}. [${(dup.score * 100).toFixed(1)}% similar] ${dup.content.slice(0, 60)}...`);
      });
    }

    return duplicates;
  }

  /**
   * Get all notes of a specific type
   */
  async getNotesByType(type: SessionNote['type']): Promise<SearchResult[]> {
    try {
      // Search with high limit to get all notes of this type
      // We'll use a generic embedding that matches the type
      const typeEmbedding = await this.generateEmbedding(type);

      const result = await this.qdrant.search(this.collectionName, {
        vector: typeEmbedding,
        limit: 100,
        with_payload: true,
        filter: {
          must: [
            {
              key: 'type',
              match: { value: type }
            }
          ]
        }
      });

      return result.map(r => ({
        score: r.score || 1.0,
        type: r.payload?.type as string || 'unknown',
        content: r.payload?.content as string || '',
        timestamp: r.payload?.timestamp as string || '',
        metadata: r.payload as Record<string, any>
      }));

    } catch (error: any) {
      console.error(`❌ Failed to get notes by type: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract high-value memories for finalization
   */
  async extractValuableMemories(): Promise<SearchResult[]> {
    console.error('💎 Extracting high-value memories...');

    // Get all notes
    const allTypes: SessionNote['type'][] = ['decision', 'hypothesis', 'blocker', 'learning', 'pattern'];
    const allNotes: SearchResult[] = [];

    for (const type of allTypes) {
      const notes = await this.getNotesByType(type);
      allNotes.push(...notes);
    }

    // Sort by recency (most recent first)
    allNotes.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    console.error(`   Found ${allNotes.length} total notes`);

    return allNotes;
  }

  /**
   * Clean up ephemeral session collection
   */
  async cleanup(): Promise<void> {
    try {
      await this.qdrant.deleteCollection(this.collectionName);
      console.error(`🗑️  Cleaned up session collection: ${this.collectionName}`);
    } catch (error: any) {
      // If collection doesn't exist, that's fine
      if (error.message?.includes('Not found')) {
        console.error(`ℹ️  Session collection already removed: ${this.collectionName}`);
      } else {
        console.error(`⚠️  Failed to cleanup session: ${error.message}`);
      }
    }
  }

  /**
   * Generate embedding using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text.slice(0, 8000), // Limit to 8K chars to stay within token limit
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI');
      }

      return embedding;

    } catch (error: any) {
      console.error(`❌ Failed to generate embedding: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    collection: string;
    sessionId: string;
    totalNotes: number;
    notesByType: Record<string, number>;
  }> {
    const collectionInfo = await this.qdrant.getCollection(this.collectionName);

    // Count notes by type
    const notesByType: Record<string, number> = {};
    const allTypes: SessionNote['type'][] = ['decision', 'hypothesis', 'blocker', 'learning', 'pattern'];

    for (const type of allTypes) {
      const notes = await this.getNotesByType(type);
      notesByType[type] = notes.length;
    }

    return {
      collection: this.collectionName,
      sessionId: this.sessionId,
      totalNotes: collectionInfo.points_count || 0,
      notesByType
    };
  }
}
