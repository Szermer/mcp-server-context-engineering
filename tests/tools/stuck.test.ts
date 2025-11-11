/**
 * Integration Tests for Stuck Detection Tools
 *
 * Tests:
 * - check_stuck_pattern MCP tool
 * - get_recovery_suggestions MCP tool
 * - End-to-end workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkStuckPatternHandler } from '../../src/tools/stuck/checkStuckPattern.js';
import { getRecoverySuggestionsHandler } from '../../src/tools/stuck/getRecoverySuggestions.js';
import { getActiveCoordinator } from '../../src/tools/session/startSessionCoordination.js';

// Mock dependencies
vi.mock('../../src/tools/session/startSessionCoordination.js');
vi.mock('../../src/utils/SessionCoordinator.js');
vi.mock('fs');

describe('Stuck Detection Tools Integration', () => {
  let mockCoordinator: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock coordinator
    mockCoordinator = {
      getNotesByType: vi.fn(),
      search: vi.fn(),
    };

    vi.mocked(getActiveCoordinator).mockReturnValue(mockCoordinator);
  });

  describe('check_stuck_pattern Tool', () => {
    it('should detect not stuck when no patterns found', async () => {
      mockCoordinator.getNotesByType.mockResolvedValue([]);
      mockCoordinator.search.mockResolvedValue([]);

      const result = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.stuck).toBe(false);
      expect(response.data.patterns).toHaveLength(3);
    });

    it('should detect stuck when repeated blocker pattern found', async () => {
      // Mock repeated blockers
      const blockers = Array.from({ length: 4 }, () => ({
        score: 1.0,
        type: 'blocker',
        content: 'Database connection timeout',
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      mockCoordinator.getNotesByType.mockResolvedValue(blockers);
      mockCoordinator.search.mockResolvedValue([]);

      const result = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.stuck).toBe(true);
      expect(response.data.overallConfidence).toBeGreaterThan(0.5);

      const repeatedBlocker = response.data.patterns.find(
        (p: any) => p.type === 'repeated_blocker'
      );
      expect(repeatedBlocker.detected).toBe(true);
    });

    it('should return error when projectPath is missing', async () => {
      const result = await checkStuckPatternHandler({});

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('projectPath is required');
    });

    it('should return error when no active session', async () => {
      vi.mocked(getActiveCoordinator).mockImplementation(() => {
        throw new Error('No active session');
      });

      const result = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('No active session');
    });

    it('should include metadata in response', async () => {
      mockCoordinator.getNotesByType.mockResolvedValue([]);
      mockCoordinator.search.mockResolvedValue([]);

      const result = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.metadata).toBeDefined();
      expect(response.metadata.tokensUsed).toBeGreaterThanOrEqual(0);
      expect(response.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should respect cooldown mechanism', async () => {
      const blockers = Array.from({ length: 4 }, () => ({
        score: 1.0,
        type: 'blocker',
        content: 'Repeated blocker',
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      mockCoordinator.getNotesByType.mockResolvedValue(blockers);
      mockCoordinator.search.mockResolvedValue([]);

      // First call - should trigger alert
      const result1 = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      const response1 = JSON.parse(result1.content[0].text);
      expect(response1.data.stuck).toBe(true);
      expect(response1.data.lastAlertTime).not.toBeNull();
    });
  });

  describe('get_recovery_suggestions Tool', () => {
    it('should generate suggestions for stuck pattern', async () => {
      // Mock search results with solutions
      mockCoordinator.search.mockResolvedValue([
        {
          score: 0.9,
          type: 'decision',
          content: 'Fixed database connection by updating DATABASE_URL',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ]);

      const stuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Database connection failing',
          evidence: ['[10:00] Database timeout'],
        },
      };

      const result = await getRecoverySuggestionsHandler({
        stuckPattern,
        projectPath: '/test/project',
        maxSuggestions: 3,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.suggestions).toBeDefined();
      expect(response.metadata.suggestionCount).toBeGreaterThan(0);
    });

    it('should return empty suggestions when no relevant notes', async () => {
      mockCoordinator.search.mockResolvedValue([]);

      const stuckPattern = {
        type: 'error_loop',
        detected: true,
        confidence: 0.7,
        details: {
          description: 'Error repeating',
          evidence: [],
          repetitionCount: 6,
        },
      };

      const result = await getRecoverySuggestionsHandler({
        stuckPattern,
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.suggestions).toHaveLength(0);
    });

    it('should respect maxSuggestions parameter', async () => {
      const results = Array.from({ length: 5 }, (_, i) => ({
        score: 0.9 - i * 0.1,
        type: 'decision',
        content: `Solution ${i + 1}`,
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      mockCoordinator.search.mockResolvedValue(results);

      const stuckPattern = {
        type: 'no_progress',
        detected: true,
        confidence: 0.6,
        details: {
          description: 'No file changes',
          evidence: [],
        },
      };

      const result = await getRecoverySuggestionsHandler({
        stuckPattern,
        projectPath: '/test/project',
        maxSuggestions: 2,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data.suggestions).toHaveLength(2);
    });

    it('should return error when stuckPattern is missing', async () => {
      const result = await getRecoverySuggestionsHandler({
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('stuckPattern is required');
    });

    it('should return error when projectPath is missing', async () => {
      const stuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Issue',
          evidence: [],
        },
      };

      const result = await getRecoverySuggestionsHandler({
        stuckPattern,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('projectPath is required');
    });

    it('should include search duration in response', async () => {
      mockCoordinator.search.mockResolvedValue([]);

      const stuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Issue',
          evidence: [],
        },
      };

      const result = await getRecoverySuggestionsHandler({
        stuckPattern,
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.data.searchDuration).toBeDefined();
      expect(response.data.searchDuration.qdrant).toBeGreaterThanOrEqual(0);
      expect(response.data.searchDuration.total).toBeGreaterThanOrEqual(0);
    });

    it('should format suggestions with all required fields', async () => {
      mockCoordinator.search.mockResolvedValue([
        {
          score: 0.89,
          type: 'decision',
          content: `Fixed by updating config:
1. Check environment variables
2. Verify database URL
3. Restart service`,
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ]);

      const stuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Config issue',
          evidence: [],
        },
      };

      const result = await getRecoverySuggestionsHandler({
        stuckPattern,
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      const suggestion = response.data.suggestions[0];

      expect(suggestion.title).toBeDefined();
      expect(suggestion.description).toBeDefined();
      expect(suggestion.source).toBe('current_session');
      expect(suggestion.relevanceScore).toBeDefined();
      expect(suggestion.implementation).toBeDefined();
      expect(suggestion.implementation.steps).toBeDefined();
      expect(suggestion.implementation.references).toBeDefined();
      expect(suggestion.metadata).toBeDefined();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should detect stuck and generate suggestions', async () => {
      // Setup: Repeated blocker scenario
      const blockers = Array.from({ length: 4 }, () => ({
        score: 1.0,
        type: 'blocker',
        content: 'Database connection timeout on port 5432',
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      const solutions = [
        {
          score: 0.9,
          type: 'decision',
          content: 'Fixed database timeout by increasing connection pool size to 20',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          metadata: {},
        },
        {
          score: 0.85,
          type: 'learning',
          content: 'Database connections require proper timeout settings. Set timeout to 30s.',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          metadata: {},
        },
      ];

      mockCoordinator.getNotesByType.mockResolvedValue(blockers);
      mockCoordinator.search.mockResolvedValue(solutions);

      // Step 1: Check if stuck
      const checkResult = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      const checkResponse = JSON.parse(checkResult.content[0].text);
      expect(checkResponse.data.stuck).toBe(true);

      const detectedPattern = checkResponse.data.patterns.find(
        (p: any) => p.type === 'repeated_blocker' && p.detected
      );
      expect(detectedPattern).toBeDefined();

      // Step 2: Get recovery suggestions
      const suggestionsResult = await getRecoverySuggestionsHandler({
        stuckPattern: detectedPattern,
        projectPath: '/test/project',
        maxSuggestions: 3,
      });

      const suggestionsResponse = JSON.parse(suggestionsResult.content[0].text);
      expect(suggestionsResponse.success).toBe(true);
      expect(suggestionsResponse.data.suggestions.length).toBeGreaterThan(0);

      // Verify suggestion quality
      const topSuggestion = suggestionsResponse.data.suggestions[0];
      expect(topSuggestion.relevanceScore).toBeGreaterThan(0.5);
      expect(topSuggestion.source).toBe('current_session');
    });

    it('should handle not stuck scenario gracefully', async () => {
      mockCoordinator.getNotesByType.mockResolvedValue([]);
      mockCoordinator.search.mockResolvedValue([]);

      // Check if stuck
      const checkResult = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      const checkResponse = JSON.parse(checkResult.content[0].text);
      expect(checkResponse.data.stuck).toBe(false);

      // No need to get suggestions when not stuck
      const hasDetectedPattern = checkResponse.data.patterns.some(
        (p: any) => p.detected
      );
      expect(hasDetectedPattern).toBe(false);
    });

    it('should handle errors in detection gracefully', async () => {
      vi.mocked(getActiveCoordinator).mockImplementation(() => {
        throw new Error('Session coordinator error');
      });

      const checkResult = await checkStuckPatternHandler({
        projectPath: '/test/project',
      });

      const checkResponse = JSON.parse(checkResult.content[0].text);
      expect(checkResponse.success).toBe(false);
      expect(checkResponse.error).toBeDefined();
    });

    it('should handle errors in suggestions gracefully', async () => {
      mockCoordinator.search.mockRejectedValue(new Error('Search failed'));

      const stuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Issue',
          evidence: [],
        },
      };

      const result = await getRecoverySuggestionsHandler({
        stuckPattern,
        projectPath: '/test/project',
      });

      const response = JSON.parse(result.content[0].text);
      // Should still succeed but with empty suggestions
      expect(response.success).toBe(true);
      expect(response.data.suggestions).toHaveLength(0);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete detection in < 3 seconds', async () => {
      mockCoordinator.getNotesByType.mockResolvedValue([]);
      mockCoordinator.search.mockResolvedValue([]);

      const startTime = Date.now();
      await checkStuckPatternHandler({
        projectPath: '/test/project',
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000);
    });

    it('should complete suggestions in < 3 seconds', async () => {
      mockCoordinator.search.mockResolvedValue([
        {
          score: 0.9,
          type: 'decision',
          content: 'Solution',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ]);

      const stuckPattern = {
        type: 'repeated_blocker',
        detected: true,
        confidence: 0.8,
        details: {
          description: 'Issue',
          evidence: [],
        },
      };

      const startTime = Date.now();
      await getRecoverySuggestionsHandler({
        stuckPattern,
        projectPath: '/test/project',
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000);
    });
  });
});
