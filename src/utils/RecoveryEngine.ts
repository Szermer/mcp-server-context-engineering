/**
 * RecoveryEngine - Generate recovery suggestions when developers are stuck
 *
 * Uses hybrid search strategy:
 * 1. Qdrant session memory - Fast (50-200ms), current session context
 * 2. Google File Search - Comprehensive (5-10s), historical knowledge
 *
 * Ranking factors:
 * - Relevance (semantic similarity)
 * - Recency (newer solutions preferred)
 * - Success rate (inferred from session outcomes)
 */

import { SessionCoordinator } from './SessionCoordinator.js';
import { StuckPattern } from './StuckDetector.js';

export interface RecoverySuggestion {
  title: string;
  description: string;
  source: 'current_session' | 'past_session' | 'pattern_library';
  relevanceScore: number;
  implementation: {
    steps: string[];
    codeExample?: string;
    references: string[];
  };
  metadata: {
    sessionId?: string;
    timestamp?: string;
    successRate?: number;
  };
}

export interface RecoveryAnalysis {
  stuckPattern: StuckPattern;
  suggestions: RecoverySuggestion[];
  searchDuration: {
    qdrant: number;
    googleFS: number;
    total: number;
  };
}

export class RecoveryEngine {
  private coordinator: SessionCoordinator;

  constructor(coordinator: SessionCoordinator, _projectPath: string) {
    this.coordinator = coordinator;
    // projectPath reserved for future Google FS integration
  }

  /**
   * Generate recovery suggestions for a stuck pattern
   */
  async generateSuggestions(
    stuckPattern: StuckPattern,
    limit: number = 3
  ): Promise<RecoveryAnalysis> {
    const startTime = Date.now();
    const searchDuration = { qdrant: 0, googleFS: 0, total: 0 };

    try {
      // Build search query from stuck pattern
      const query = this.buildSearchQuery(stuckPattern);

      // Search current session (Qdrant) - Fast
      const qdrantStart = Date.now();
      const currentSessionResults = await this.searchCurrentSession(query);
      searchDuration.qdrant = Date.now() - qdrantStart;

      // TODO: Search historical sessions (Google FS) - Comprehensive
      // Will be implemented in Phase 2.2
      const historicalResults: RecoverySuggestion[] = [];
      searchDuration.googleFS = 0;

      // Combine and rank suggestions
      const allSuggestions = [...currentSessionResults, ...historicalResults];
      const rankedSuggestions = this.rankSuggestions(allSuggestions, stuckPattern);

      // Take top N suggestions
      const topSuggestions = rankedSuggestions.slice(0, limit);

      searchDuration.total = Date.now() - startTime;

      return {
        stuckPattern,
        suggestions: topSuggestions,
        searchDuration,
      };
    } catch (error: any) {
      console.error(`❌ Failed to generate suggestions: ${error.message}`);

      searchDuration.total = Date.now() - startTime;

      return {
        stuckPattern,
        suggestions: [],
        searchDuration,
      };
    }
  }

  /**
   * Build search query from stuck pattern
   */
  private buildSearchQuery(pattern: StuckPattern): string {
    const { type, details } = pattern;

    if (type === 'repeated_blocker') {
      // Extract the blocker content from evidence
      const blockerContent = details.evidence[0] || '';
      const content = blockerContent.replace(/^\[.*?\]\s*/, ''); // Remove timestamp
      return `solution for: ${content}`;
    } else if (type === 'error_loop') {
      // Extract error message
      const errorContent = details.evidence[0] || '';
      const content = errorContent.replace(/^\[.*?\]\s*/, '');
      return `fix for: ${content}`;
    } else if (type === 'no_progress') {
      // Generic query for productivity techniques
      return 'overcome development blocker productivity tips';
    }

    return 'development problem solution';
  }

  /**
   * Search current session for related solutions
   */
  private async searchCurrentSession(query: string): Promise<RecoverySuggestion[]> {
    try {
      // Search for decisions and learnings that might contain solutions
      const results = await this.coordinator.search(query, 10);

      // Filter for solution-relevant notes
      const solutionNotes = results.filter(
        r =>
          r.type === 'decision' ||
          r.type === 'learning' ||
          r.type === 'pattern'
      );

      // Convert to suggestions
      return solutionNotes.map(note => ({
        title: this.extractTitle(note.content),
        description: note.content,
        source: 'current_session' as const,
        relevanceScore: note.score,
        implementation: {
          steps: this.extractSteps(note.content),
          codeExample: this.extractCodeExample(note.content),
          references: [note.timestamp],
        },
        metadata: {
          timestamp: note.timestamp,
        },
      }));
    } catch (error: any) {
      console.error(`❌ Current session search failed: ${error.message}`);
      return [];
    }
  }

  // Removed searchHistoricalSessions - will be added in Phase 2.2 Google FS integration

  /**
   * Rank suggestions by relevance, recency, and success rate
   */
  private rankSuggestions(
    suggestions: RecoverySuggestion[],
    _stuckPattern: StuckPattern
  ): RecoverySuggestion[] {
    // stuckPattern reserved for future context-aware ranking
    return suggestions
      .map(suggestion => {
        // Calculate composite score
        const relevanceWeight = 0.5;
        const recencyWeight = 0.3;
        const successWeight = 0.2;

        const relevanceScore = suggestion.relevanceScore;
        const recencyScore = this.calculateRecencyScore(
          suggestion.metadata.timestamp
        );
        const successScore = suggestion.metadata.successRate || 0.5;

        const compositeScore =
          relevanceWeight * relevanceScore +
          recencyWeight * recencyScore +
          successWeight * successScore;

        return {
          ...suggestion,
          compositeScore,
        };
      })
      .sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0))
      .map(({ compositeScore, ...suggestion }) => suggestion);
  }

  /**
   * Calculate recency score (newer = higher score)
   */
  private calculateRecencyScore(timestamp?: string): number {
    if (!timestamp) return 0.5;

    const now = Date.now();
    const noteTime = new Date(timestamp).getTime();
    const ageMs = now - noteTime;

    // 0-1 hour = 1.0, 1-24 hours = 0.7, 1-7 days = 0.4, 7+ days = 0.2
    const ageHours = ageMs / (1000 * 60 * 60);

    if (ageHours < 1) return 1.0;
    if (ageHours < 24) return 0.7;
    if (ageHours < 24 * 7) return 0.4;
    return 0.2;
  }

  // Removed inferSuccessRate - will be used in Phase 2.2 Google FS integration

  /**
   * Extract title from content (first sentence or first 50 chars)
   */
  private extractTitle(content: string): string {
    const firstSentence = content.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      return firstSentence[0].trim();
    }
    return content.slice(0, 50) + (content.length > 50 ? '...' : '');
  }

  /**
   * Extract actionable steps from content
   */
  private extractSteps(content: string): string[] {
    // Look for numbered lists
    const numberedSteps = content.match(/^\d+\.\s+(.+)$/gm);
    if (numberedSteps) {
      return numberedSteps.map(step => step.replace(/^\d+\.\s+/, ''));
    }

    // Look for bullet points
    const bulletSteps = content.match(/^[-*]\s+(.+)$/gm);
    if (bulletSteps) {
      return bulletSteps.map(step => step.replace(/^[-*]\s+/, ''));
    }

    // Fallback: split by sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  /**
   * Extract code example from content
   */
  private extractCodeExample(content: string): string | undefined {
    // Look for code blocks (```...```)
    const codeBlock = content.match(/```[\s\S]*?```/);
    if (codeBlock) {
      return codeBlock[0].replace(/```\w*\n?/g, '').trim();
    }

    // Look for inline code (`...`)
    const inlineCode = content.match(/`[^`]+`/g);
    if (inlineCode && inlineCode.length > 2) {
      return inlineCode.join('\n');
    }

    return undefined;
  }
}
