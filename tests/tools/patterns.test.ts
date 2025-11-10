/**
 * Tests for Patterns Module
 *
 * Tests the patterns tools and utilities with real data from ~/.shared-patterns
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { homedir } from 'os';

describe('Patterns Module - Filesystem Utilities', () => {
  describe('getSharedPatternsPath', () => {
    it('should return the shared patterns directory path', async () => {
      const { getSharedPatternsPath } = await import('../../dist/utils/filesystem.js');
      const patternsPath = getSharedPatternsPath();

      expect(patternsPath).toBeDefined();
      expect(patternsPath).toContain('.shared-patterns');
      expect(patternsPath).toBe(path.join(homedir(), '.shared-patterns'));
    });
  });

  describe('getPatternCategories', () => {
    it('should list all pattern categories', async () => {
      const { getPatternCategories } = await import('../../dist/utils/filesystem.js');
      const categories = await getPatternCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);

      // Should include known categories from the pattern library
      expect(categories).toContain('mcp-integration');
    });
  });

  describe('searchPatternsInCategory', () => {
    it('should find patterns in mcp-integration category', async () => {
      const { searchPatternsInCategory } = await import('../../dist/utils/filesystem.js');
      const patterns = await searchPatternsInCategory('mcp-integration');

      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);

      // Each pattern should have required fields
      patterns.forEach(pattern => {
        expect(pattern.id).toBeDefined();
        expect(pattern.name).toBeDefined();
        expect(pattern.category).toBe('mcp-integration');
        expect(pattern.path).toBeDefined();
        expect(pattern.description).toBeDefined();
        expect(typeof pattern.hasExecutable).toBe('boolean');
      });
    });

    it('should filter patterns by keyword', async () => {
      const { searchPatternsInCategory } = await import('../../dist/utils/filesystem.js');
      const patterns = await searchPatternsInCategory('mcp-integration', 'RLS');

      expect(Array.isArray(patterns)).toBe(true);

      // Should find the rls-policy-generator pattern
      const rlsPattern = patterns.find(p => p.name.toLowerCase().includes('rls'));
      expect(rlsPattern).toBeDefined();

      if (rlsPattern) {
        expect(rlsPattern.category).toBe('mcp-integration');
        expect(rlsPattern.hasExecutable).toBe(true);
      }
    });

    it('should filter by executable flag', async () => {
      const { searchPatternsInCategory } = await import('../../dist/utils/filesystem.js');
      const executableOnly = await searchPatternsInCategory('mcp-integration', undefined, true);

      expect(Array.isArray(executableOnly)).toBe(true);

      // All returned patterns should have executable implementations
      executableOnly.forEach(pattern => {
        expect(pattern.hasExecutable).toBe(true);
      });
    });

    it('should extract quality scores from SKILL files', async () => {
      const { searchPatternsInCategory } = await import('../../dist/utils/filesystem.js');
      const patterns = await searchPatternsInCategory('mcp-integration');

      // Find patterns with quality scores
      const patternsWithQuality = patterns.filter(p => p.quality !== undefined);

      expect(patternsWithQuality.length).toBeGreaterThan(0);

      patternsWithQuality.forEach(pattern => {
        expect(pattern.quality).toBeDefined();
        expect(typeof pattern.quality).toBe('number');
        expect(pattern.quality!).toBeGreaterThanOrEqual(0);
        expect(pattern.quality!).toBeLessThanOrEqual(100);
      });
    });
  });
});

describe('Patterns Module - Tool Handlers', () => {
  describe('searchPatternsHandler', () => {
    it('should handle search with category filter', async () => {
      const { searchPatternsHandler } = await import('../../dist/tools/patterns/searchPatterns.js');

      const response = await searchPatternsHandler({
        category: 'mcp-integration',
      });

      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);

      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.resultsCount).toBe(result.data.length);
    });

    it('should handle search with keyword', async () => {
      const { searchPatternsHandler } = await import('../../dist/tools/patterns/searchPatterns.js');

      const response = await searchPatternsHandler({
        category: 'mcp-integration',
        keyword: 'progressive',
      });

      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);

      // Should find progressive-tool-discovery pattern
      const progressivePattern = result.data.find((p: any) => p.name.includes('progressive'));
      expect(progressivePattern).toBeDefined();
    });

    it('should handle search with limit', async () => {
      const { searchPatternsHandler } = await import('../../dist/tools/patterns/searchPatterns.js');

      const response = await searchPatternsHandler({
        category: 'mcp-integration',
        limit: 1,
      });

      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(1);
      expect(result.metadata.resultsCount).toBeLessThanOrEqual(1);
    });

    it('should estimate token usage accurately', async () => {
      const { searchPatternsHandler } = await import('../../dist/tools/patterns/searchPatterns.js');

      const response = await searchPatternsHandler({
        category: 'mcp-integration',
      });

      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      // Token count should be reasonable for metadata (not full content)
      expect(result.metadata.tokensUsed).toBeLessThan(10000);
    });

    it('should handle errors gracefully', async () => {
      const { searchPatternsHandler } = await import('../../dist/tools/patterns/searchPatterns.js');

      const response = await searchPatternsHandler({
        category: 'nonexistent-category-xyz',
      });

      const result = JSON.parse(response.content[0].text);
      // Should still succeed but return empty results
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(0);
    });
  });
});

describe('Integration Test - End-to-End Pattern Discovery', () => {
  it('should complete full pattern discovery workflow', async () => {
    const { searchPatternsHandler } = await import('../../dist/tools/patterns/searchPatterns.js');

    // Step 1: Search for RLS-related patterns
    const searchResponse = await searchPatternsHandler({
      category: 'mcp-integration',
      keyword: 'RLS',
      includeExecutable: true,
    });

    const searchResult = JSON.parse(searchResponse.content[0].text);
    expect(searchResult.success).toBe(true);
    expect(searchResult.data.length).toBeGreaterThan(0);

    // Step 2: Verify we found the RLS policy generator
    const rlsGenerator = searchResult.data.find((p: any) =>
      p.name.includes('rls-policy-generator')
    );
    expect(rlsGenerator).toBeDefined();
    expect(rlsGenerator.hasExecutable).toBe(true);
    expect(rlsGenerator.category).toBe('mcp-integration');

    // Step 3: Verify token savings
    // Should be much less than loading full skill content
    expect(searchResult.metadata.tokensUsed).toBeLessThan(1000);
  });
});
