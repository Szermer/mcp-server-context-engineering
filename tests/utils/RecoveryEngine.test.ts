/**
 * Unit Tests for RecoveryEngine
 *
 * Tests recovery suggestion generation:
 * - Current session search (Qdrant)
 * - Composite scoring (relevance + recency + success)
 * - Suggestion formatting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecoveryEngine } from '../../src/utils/RecoveryEngine.js';
import { SessionCoordinator } from '../../src/utils/SessionCoordinator.js';
import { StuckPattern } from '../../src/utils/StuckDetector.js';

// Mock SessionCoordinator
vi.mock('../../src/utils/SessionCoordinator.js');

describe('RecoveryEngine', () => {
  let mockCoordinator: SessionCoordinator;
  let engine: RecoveryEngine;
  const projectPath = '/test/project';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock coordinator
    mockCoordinator = {
      search: vi.fn(),
    } as any;

    // Create engine instance
    engine = new RecoveryEngine(mockCoordinator, projectPath);
  });

  describe('Suggestion Generation', () => {
    it('should return empty suggestions when no relevant notes found', async () => {
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Database connection failing',
          evidence: ['[10:00] Database timeout'],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 3);

      expect(analysis.suggestions).toHaveLength(0);
    });

    it('should generate suggestions from current session', async () => {
      // Mock search results with solutions
      vi.mocked(mockCoordinator.search).mockResolvedValue([
        {
          score: 0.89,
          type: 'decision',
          content: 'Fixed database connection by updating DATABASE_URL environment variable to include correct port 5432',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
          metadata: {},
        },
        {
          score: 0.75,
          type: 'learning',
          content: 'Database connections require proper timeout configuration. Set timeout to 30 seconds.',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
          metadata: {},
        },
      ]);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Database connection timeout',
          evidence: ['[10:00] Database timeout'],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 3);

      expect(analysis.suggestions.length).toBeGreaterThan(0);
      expect(analysis.suggestions[0].source).toBe('current_session');
    });

    it('should respect maxSuggestions limit', async () => {
      // Mock 5 search results
      const results = Array.from({ length: 5 }, (_, i) => ({
        score: 0.9 - i * 0.1,
        type: 'decision' as const,
        content: `Solution ${i + 1}`,
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'error_loop',
        detected: true,
        confidence: 0.7,
        details: {
          description: 'TypeError repeating',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 2);

      expect(analysis.suggestions).toHaveLength(2);
    });

    it('should track search duration', async () => {
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);

      const stuckPattern: StuckPattern = {
        type: 'no_progress',
        detected: true,
        confidence: 0.6,
        details: {
          description: 'No file changes',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern);

      expect(analysis.searchDuration.qdrant).toBeGreaterThanOrEqual(0);
      expect(analysis.searchDuration.total).toBeGreaterThanOrEqual(0);
      expect(analysis.searchDuration.googleFS).toBe(0); // Not implemented in v1.0
    });
  });

  describe('Query Building', () => {
    it('should build query from repeated blocker pattern', async () => {
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Blocker mentioned 4 times',
          evidence: [
            '[10:00] Cannot connect to database',
            '[10:15] Database connection failing',
            '[10:30] Still blocked on database',
          ],
        },
      };

      await engine.generateSuggestions(stuckPattern);

      expect(mockCoordinator.search).toHaveBeenCalledWith(
        expect.stringContaining('Cannot connect to database'),
        expect.any(Number)
      );
    });

    it('should build query from error loop pattern', async () => {
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);

      const stuckPattern: StuckPattern = {
        type: 'error_loop',
        detected: true,
        confidence: 0.7,
        details: {
          description: 'Same error occurred 6 times',
          evidence: [
            '[10:00] TypeError: Cannot read property id of undefined',
            '[10:10] TypeError: Cannot read property id of undefined',
          ],
          repetitionCount: 6,
        },
      };

      await engine.generateSuggestions(stuckPattern);

      expect(mockCoordinator.search).toHaveBeenCalledWith(
        expect.stringContaining('TypeError'),
        expect.any(Number)
      );
    });

    it('should build generic query for no progress pattern', async () => {
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);

      const stuckPattern: StuckPattern = {
        type: 'no_progress',
        detected: true,
        confidence: 0.6,
        details: {
          description: 'No file changes for 25 minutes',
          evidence: [],
          idleTime: '25m',
        },
      };

      await engine.generateSuggestions(stuckPattern);

      expect(mockCoordinator.search).toHaveBeenCalledWith(
        expect.stringContaining('blocker'),
        expect.any(Number)
      );
    });
  });

  describe('Ranking Algorithm', () => {
    it('should rank by composite score (relevance + recency + success)', async () => {
      const now = Date.now();

      // Mock results with different characteristics
      const results = [
        {
          score: 0.6, // Lower relevance
          type: 'decision' as const,
          content: 'Old solution with success keyword',
          timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          metadata: {},
        },
        {
          score: 0.9, // High relevance
          type: 'decision' as const,
          content: 'Recent solution',
          timestamp: new Date(now - 30 * 60 * 1000).toISOString(), // 30 min ago
          metadata: {},
        },
        {
          score: 0.7, // Medium relevance
          type: 'learning' as const,
          content: 'Medium recent solution',
          timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Test blocker',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 3);

      // Most recent and relevant should be first
      expect(analysis.suggestions[0].relevanceScore).toBeGreaterThan(
        analysis.suggestions[1]?.relevanceScore ?? 0
      );
    });

    it('should prioritize recent solutions', async () => {
      const now = Date.now();

      const results = [
        {
          score: 0.8,
          type: 'decision' as const,
          content: 'Old solution',
          timestamp: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          metadata: {},
        },
        {
          score: 0.8, // Same relevance
          type: 'decision' as const,
          content: 'Recent solution',
          timestamp: new Date(now - 10 * 60 * 1000).toISOString(), // 10 min ago
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'error_loop',
        detected: true,
        confidence: 0.7,
        details: {
          description: 'Error loop',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 2);

      // Recent solution should be ranked higher
      expect(analysis.suggestions[0].description).toContain('Recent');
    });

    it('should filter for solution-relevant note types', async () => {
      const results = [
        {
          score: 0.9,
          type: 'decision' as const, // Relevant
          content: 'Decision about solution',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          score: 0.85,
          type: 'blocker' as const, // Not relevant for suggestions
          content: 'Blocker note',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          score: 0.8,
          type: 'learning' as const, // Relevant
          content: 'Learning about solution',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          score: 0.75,
          type: 'pattern' as const, // Relevant
          content: 'Pattern for solution',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Test',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 5);

      // Should only include decision, learning, pattern types
      expect(analysis.suggestions.length).toBe(3);
      expect(analysis.suggestions.every(s => s.source === 'current_session')).toBe(true);
    });
  });

  describe('Content Extraction', () => {
    it('should extract title from content', async () => {
      const results = [
        {
          score: 0.9,
          type: 'decision' as const,
          content: 'Fixed database connection by updating environment variables. This solved the timeout issue.',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Database issue',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].title).toBeTruthy();
      expect(analysis.suggestions[0].title.length).toBeGreaterThan(0);
    });

    it('should extract numbered steps from content', async () => {
      const results = [
        {
          score: 0.9,
          type: 'decision' as const,
          content: `Fixed deployment issue:
1. Update IAM permissions
2. Add deploy user to app-admins group
3. Restart deployment service`,
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Deployment failing',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].implementation.steps.length).toBeGreaterThan(0);
      expect(analysis.suggestions[0].implementation.steps[0]).toContain('IAM');
    });

    it('should extract bullet point steps from content', async () => {
      const results = [
        {
          score: 0.9,
          type: 'learning' as const,
          content: `Solution steps:
- Check environment variables
- Verify database URL format
- Restart the service`,
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'error_loop',
        detected: true,
        confidence: 0.7,
        details: {
          description: 'Error repeating',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].implementation.steps.length).toBeGreaterThan(0);
    });

    it('should extract code examples from content', async () => {
      const results = [
        {
          score: 0.9,
          type: 'decision' as const,
          content: `Fixed by updating config:
\`\`\`bash
export DATABASE_URL=postgres://user:pass@localhost:5432/db
\`\`\``,
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Config issue',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].implementation.codeExample).toBeTruthy();
      expect(analysis.suggestions[0].implementation.codeExample).toContain('DATABASE_URL');
    });

    it('should include timestamps in references', async () => {
      const timestamp = new Date().toISOString();
      const results = [
        {
          score: 0.9,
          type: 'decision' as const,
          content: 'Solution description',
          timestamp,
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Issue',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].implementation.references).toContain(timestamp);
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      vi.mocked(mockCoordinator.search).mockRejectedValue(
        new Error('Qdrant connection failed')
      );

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Test',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern);

      expect(analysis.suggestions).toHaveLength(0);
      expect(analysis.searchDuration.total).toBeGreaterThan(0);
    });

    it('should return empty suggestions on error', async () => {
      vi.mocked(mockCoordinator.search).mockImplementation(() => {
        throw new Error('Network error');
      });

      const stuckPattern: StuckPattern = {
        type: 'error_loop',
        detected: true,
        confidence: 0.7,
        details: {
          description: 'Error',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern);

      expect(analysis.suggestions).toEqual([]);
    });
  });

  describe('Suggestion Metadata', () => {
    it('should include relevance score in suggestions', async () => {
      const results = [
        {
          score: 0.89,
          type: 'decision' as const,
          content: 'Solution',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Issue',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].relevanceScore).toBe(0.89);
    });

    it('should include timestamp in metadata', async () => {
      const timestamp = new Date().toISOString();
      const results = [
        {
          score: 0.9,
          type: 'decision' as const,
          content: 'Solution',
          timestamp,
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'error_loop',
        detected: true,
        confidence: 0.7,
        details: {
          description: 'Error',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].metadata.timestamp).toBe(timestamp);
    });

    it('should mark source as current_session', async () => {
      const results = [
        {
          score: 0.9,
          type: 'learning' as const,
          content: 'Learning',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(results);

      const stuckPattern: StuckPattern = {
        type: 'no_progress',
        detected: true,
        confidence: 0.6,
        details: {
          description: 'No progress',
          evidence: [],
        },
      };

      const analysis = await engine.generateSuggestions(stuckPattern, 1);

      expect(analysis.suggestions[0].source).toBe('current_session');
    });
  });
});
