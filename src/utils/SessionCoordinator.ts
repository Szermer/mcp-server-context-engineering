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
  type: 'decision' | 'hypothesis' | 'blocker' | 'learning' | 'pattern' | 'constraint';
  content: string;
  metadata?: Record<string, any>;
}

export interface Constraint {
  id: string;
  content: string;
  detected_from: 'auto' | 'explicit';
  timestamp: string;
  scope: 'session' | 'task' | 'file';
  status: 'active' | 'lifted';
  keywords: string[];
  violated_count: number;
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

    // Debug: Log environment variable status
    console.error('[SessionCoordinator] Environment check:', {
      hasQdrantUrl: !!qdrantUrl,
      hasQdrantApiKey: !!qdrantApiKey,
      hasOpenAIKey: !!openaiApiKey,
      qdrantUrlLength: qdrantUrl?.length || 0,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('QDRANT') || k.includes('OPENAI'))
    });

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
        // Ensure payload index exists on existing collection
        await this.ensurePayloadIndex();
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

      // Create payload index on 'type' field for efficient filtering
      await this.ensurePayloadIndex();

      // Optionally seed with relevant past knowledge
      await this.seedFromArchive();

    } catch (error: any) {
      console.error(`❌ Failed to initialize session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure payload index exists on 'type' field for efficient filtering
   */
  private async ensurePayloadIndex(): Promise<void> {
    try {
      await this.qdrant.createPayloadIndex(this.collectionName, {
        field_name: 'type',
        field_schema: 'keyword'
      });
      console.error(`✅ Created payload index on 'type' field`);
    } catch (error: any) {
      // Index might already exist, which is fine
      if (error.message?.includes('already exists')) {
        console.error(`   Payload index already exists (OK)`);
      } else {
        console.error(`⚠️  Failed to create payload index: ${error.message}`);
      }
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
      // Use scroll API to retrieve all points of this type
      // This is more reliable than semantic search with filters
      const result = await this.qdrant.scroll(this.collectionName, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        filter: {
          must: [
            {
              key: 'type',
              match: { value: type }
            }
          ]
        }
      });

      // Extract points from scroll response
      const points = result.points || [];

      return points.map(point => ({
        score: 1.0, // No semantic score for exact matches
        type: point.payload?.type as string || 'unknown',
        content: point.payload?.content as string || '',
        timestamp: point.payload?.timestamp as string || '',
        metadata: point.payload as Record<string, any>
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
    const allTypes: SessionNote['type'][] = ['decision', 'hypothesis', 'blocker', 'learning', 'pattern', 'constraint'];

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

  /**
   * Track a constraint (explicit or auto-detected)
   */
  async trackConstraint(
    content: string,
    detectedFrom: 'auto' | 'explicit' = 'explicit',
    scope: 'session' | 'task' | 'file' = 'session',
    keywords?: string[]
  ): Promise<Constraint> {
    const constraint: Constraint = {
      id: `constraint-${Date.now()}`,
      content,
      detected_from: detectedFrom,
      timestamp: new Date().toISOString(),
      scope,
      status: 'active',
      keywords: keywords || this.extractKeywords(content),
      violated_count: 0
    };

    // Save as a session note
    await this.saveNote({
      type: 'constraint',
      content,
      metadata: {
        constraint_id: constraint.id,
        detected_from: detectedFrom,
        scope,
        status: 'active',
        keywords: constraint.keywords
      }
    });

    console.log(`🔒 Tracked constraint: ${content}`);
    return constraint;
  }

  /**
   * Get all active constraints
   */
  async getActiveConstraints(): Promise<Constraint[]> {
    const constraintNotes = await this.getNotesByType('constraint');

    return constraintNotes
      .filter(note => note.metadata?.status === 'active')
      .map(note => ({
        id: note.metadata?.constraint_id || `constraint-${Date.now()}`,
        content: note.content,
        detected_from: note.metadata?.detected_from || 'explicit',
        timestamp: note.timestamp,
        scope: note.metadata?.scope || 'session',
        status: 'active' as const,
        keywords: note.metadata?.keywords || [],
        violated_count: note.metadata?.violated_count || 0,
        metadata: note.metadata
      }));
  }

  /**
   * Lift (deactivate) a constraint
   */
  async liftConstraint(constraintId: string): Promise<void> {
    // Get constraint notes
    const constraintNotes = await this.getNotesByType('constraint');
    const constraint = constraintNotes.find(n => n.metadata?.constraint_id === constraintId);

    if (!constraint) {
      throw new Error(`Constraint not found: ${constraintId}`);
    }

    // Save a new note marking it as lifted
    await this.saveNote({
      type: 'constraint',
      content: `[LIFTED] ${constraint.content}`,
      metadata: {
        constraint_id: constraintId,
        detected_from: constraint.metadata?.detected_from,
        scope: constraint.metadata?.scope,
        status: 'lifted',
        keywords: constraint.metadata?.keywords,
        lifted_at: new Date().toISOString()
      }
    });

    console.log(`🔓 Lifted constraint: ${constraint.content}`);
  }

  /**
   * Check if a proposed action would violate any active constraints
   */
  async checkViolation(proposedAction: string): Promise<{
    violated: boolean;
    violations: Array<{
      constraint: Constraint;
      severity: 'high' | 'medium' | 'low';
      reason: string;
    }>;
  }> {
    const activeConstraints = await this.getActiveConstraints();
    const violations: Array<{
      constraint: Constraint;
      severity: 'high' | 'medium' | 'low';
      reason: string;
    }> = [];

    // Generate embedding for proposed action
    const actionEmbedding = await this.generateEmbedding(proposedAction);

    // Check each active constraint
    for (const constraint of activeConstraints) {
      const constraintEmbedding = await this.generateEmbedding(constraint.content);

      // Calculate semantic similarity
      const similarity = this.cosineSimilarity(actionEmbedding, constraintEmbedding);

      // Also check keyword matches
      const keywordMatch = this.checkKeywordMatch(proposedAction, constraint.keywords);

      // Determine if this is a violation
      if (similarity > 0.5 || keywordMatch) {
        // Determine severity based on constraint type and scope
        const severity = constraint.scope === 'session' ? 'high' : 'medium';

        violations.push({
          constraint,
          severity,
          reason: keywordMatch
            ? `Matches constraint keywords: ${constraint.keywords.join(', ')}`
            : `Semantically similar to constraint (${(similarity * 100).toFixed(0)}% match)`
        });
      }
    }

    return {
      violated: violations.length > 0,
      violations
    };
  }

  /**
   * Extract keywords from constraint text
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const lowerText = text.toLowerCase();

    // Common constraint indicators
    const indicators = [
      'no ', 'not ', "don't ", "doesn't ", 'never ',
      'must ', 'always ', 'require ', 'should ',
      'avoid ', 'prevent ', 'prohibit ', 'forbidden '
    ];

    // Check for indicators and extract following words
    for (const indicator of indicators) {
      const index = lowerText.indexOf(indicator);
      if (index !== -1) {
        const afterIndicator = lowerText.slice(index + indicator.length);
        const words = afterIndicator.split(/\s+/).slice(0, 5); // Get next 5 words
        keywords.push(indicator.trim(), ...words.filter(w => w.length > 2));
      }
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Check if text contains constraint keywords
   */
  private checkKeywordMatch(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
