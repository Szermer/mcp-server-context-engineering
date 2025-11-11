/**
 * Unit Tests for StuckDetector
 *
 * Tests all 3 detection types:
 * 1. Repeated Blocker
 * 2. No Progress (file changes)
 * 3. Error Loop
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StuckDetector } from '../../src/utils/StuckDetector.js';
import { SessionCoordinator } from '../../src/utils/SessionCoordinator.js';
import * as fs from 'fs';

// Mock SessionCoordinator
vi.mock('../../src/utils/SessionCoordinator.js');

// Mock filesystem
vi.mock('fs');

describe('StuckDetector', () => {
  let mockCoordinator: SessionCoordinator;
  let detector: StuckDetector;
  const projectPath = '/test/project';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock coordinator
    mockCoordinator = {
      getNotesByType: vi.fn(),
      search: vi.fn(),
    } as any;

    // Create detector instance
    detector = new StuckDetector(mockCoordinator, projectPath);
  });

  describe('Repeated Blocker Detection', () => {
    it('should not detect stuck when fewer than 3 blockers', async () => {
      // Mock 2 blockers
      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue([
        {
          score: 1.0,
          type: 'blocker',
          content: 'Database connection failing',
          timestamp: '2025-11-09T10:00:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker',
          content: 'Database connection failing',
          timestamp: '2025-11-09T10:15:00Z',
          metadata: {},
        },
      ]);

      const analysis = await detector.analyze();

      const repeatedBlocker = analysis.patterns.find(p => p.type === 'repeated_blocker');
      expect(repeatedBlocker?.detected).toBe(false);
    });

    it('should detect stuck when same blocker mentioned 3+ times', async () => {
      // Mock 4 similar blockers
      const blockers = [
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'Database connection timeout on port 5432',
          timestamp: '2025-11-09T10:00:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'Database connection timeout on port 5432',
          timestamp: '2025-11-09T10:15:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'Database timeout port 5432',
          timestamp: '2025-11-09T10:30:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'DB connection timeout 5432',
          timestamp: '2025-11-09T10:45:00Z',
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);

      const analysis = await detector.analyze();

      const repeatedBlocker = analysis.patterns.find(p => p.type === 'repeated_blocker');
      expect(repeatedBlocker?.detected).toBe(true);
      expect(repeatedBlocker?.confidence).toBeGreaterThan(0.5);
      expect(repeatedBlocker?.details.evidence.length).toBeGreaterThanOrEqual(3);
    });

    it('should calculate confidence based on repetition count and time span', async () => {
      // Mock 5 blockers over 2 hours
      const blockers = Array.from({ length: 5 }, (_, i) => ({
        score: 1.0,
        type: 'blocker' as const,
        content: 'Cannot deploy to staging',
        timestamp: new Date(Date.now() - (4 - i) * 30 * 60 * 1000).toISOString(), // 30 min apart
        metadata: {},
      }));

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);

      const analysis = await detector.analyze();

      const repeatedBlocker = analysis.patterns.find(p => p.type === 'repeated_blocker');
      expect(repeatedBlocker?.detected).toBe(true);
      // Confidence should increase with more repetitions and longer time span
      expect(repeatedBlocker?.confidence).toBeGreaterThan(0.7);
    });

    it('should group similar blockers using semantic similarity', async () => {
      // Mock different but related blockers
      const blockers = [
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'Authentication failing with JWT token',
          timestamp: '2025-11-09T10:00:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'JWT token authentication error',
          timestamp: '2025-11-09T10:15:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'Auth fails with token JWT',
          timestamp: '2025-11-09T10:30:00Z',
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);

      const analysis = await detector.analyze();

      const repeatedBlocker = analysis.patterns.find(p => p.type === 'repeated_blocker');
      expect(repeatedBlocker?.detected).toBe(true);
    });

    it('should not group dissimilar blockers', async () => {
      // Mock different blockers
      const blockers = [
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'Database connection failing',
          timestamp: '2025-11-09T10:00:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'CSS styling not applied',
          timestamp: '2025-11-09T10:15:00Z',
          metadata: {},
        },
        {
          score: 1.0,
          type: 'blocker' as const,
          content: 'API endpoint returns 404',
          timestamp: '2025-11-09T10:30:00Z',
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);

      const analysis = await detector.analyze();

      const repeatedBlocker = analysis.patterns.find(p => p.type === 'repeated_blocker');
      expect(repeatedBlocker?.detected).toBe(false);
    });
  });

  describe('No Progress Detection', () => {
    it('should not detect stuck when files were modified recently', async () => {
      // Mock recent file modification (5 minutes ago)
      const recentTime = Date.now() - 5 * 60 * 1000;

      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'src', isDirectory: () => true } as any,
      ]);

      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: recentTime,
      } as any);

      const analysis = await detector.analyze();

      const noProgress = analysis.patterns.find(p => p.type === 'no_progress');
      expect(noProgress?.detected).toBe(false);
    });

    it('should detect stuck when no files modified for 20+ minutes', async () => {
      // Mock file modification 25 minutes ago
      const oldTime = Date.now() - 25 * 60 * 1000;

      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'src', isDirectory: () => false } as any,
        { name: 'index.ts', isDirectory: () => false } as any,
      ]);

      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: oldTime,
      } as any);

      const analysis = await detector.analyze();

      const noProgress = analysis.patterns.find(p => p.type === 'no_progress');
      expect(noProgress?.detected).toBe(true);
      expect(noProgress?.confidence).toBeGreaterThan(0.5);
    });

    it('should calculate confidence based on idle time', async () => {
      // Mock file modification 45 minutes ago
      const oldTime = Date.now() - 45 * 60 * 1000;

      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'test.ts', isDirectory: () => false } as any,
      ]);

      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: oldTime,
      } as any);

      const analysis = await detector.analyze();

      const noProgress = analysis.patterns.find(p => p.type === 'no_progress');
      expect(noProgress?.detected).toBe(true);
      // Longer idle time = higher confidence
      expect(noProgress?.confidence).toBeGreaterThan(0.7);
    });

    it('should skip ignored directories', async () => {
      const recentTime = Date.now() - 5 * 60 * 1000;
      const oldTime = Date.now() - 60 * 60 * 1000; // 60 min ago

      // Mock directory structure with ignored directories
      vi.mocked(fs.readdirSync)
        .mockReturnValueOnce([
          { name: 'node_modules', isDirectory: () => true } as any,
          { name: '.git', isDirectory: () => true } as any,
          { name: 'src', isDirectory: () => true } as any,
        ])
        .mockReturnValueOnce([
          { name: 'index.ts', isDirectory: () => false } as any,
        ]);

      vi.mocked(fs.statSync)
        .mockReturnValueOnce({ mtimeMs: oldTime } as any) // node_modules (should be ignored)
        .mockReturnValueOnce({ mtimeMs: recentTime } as any); // index.ts (should be checked)

      const analysis = await detector.analyze();

      const noProgress = analysis.patterns.find(p => p.type === 'no_progress');
      expect(noProgress?.detected).toBe(false); // Recent file found in src/
    });
  });

  describe('Error Loop Detection', () => {
    it('should not detect stuck when fewer than 5 errors', async () => {
      // Mock 3 errors
      vi.mocked(mockCoordinator.search).mockResolvedValue([
        {
          score: 0.9,
          type: 'decision',
          content: 'Error: TypeError in component',
          timestamp: '2025-11-09T10:00:00Z',
          metadata: {},
        },
        {
          score: 0.85,
          type: 'learning',
          content: 'Error: TypeError in component',
          timestamp: '2025-11-09T10:15:00Z',
          metadata: {},
        },
        {
          score: 0.8,
          type: 'blocker',
          content: 'TypeError error',
          timestamp: '2025-11-09T10:30:00Z',
          metadata: {},
        },
      ]);

      const analysis = await detector.analyze();

      const errorLoop = analysis.patterns.find(p => p.type === 'error_loop');
      expect(errorLoop?.detected).toBe(false);
    });

    it('should detect stuck when same error occurs 5+ times', async () => {
      // Mock 6 similar errors
      const errors = Array.from({ length: 6 }, (_, i) => ({
        score: 0.9 - i * 0.05,
        type: 'blocker' as const,
        content: `TypeError: Cannot read property 'id' of undefined at line ${100 + i}`,
        timestamp: new Date(Date.now() - (5 - i) * 10 * 60 * 1000).toISOString(),
        metadata: {},
      }));

      vi.mocked(mockCoordinator.search).mockResolvedValue(errors);

      const analysis = await detector.analyze();

      const errorLoop = analysis.patterns.find(p => p.type === 'error_loop');
      expect(errorLoop?.detected).toBe(true);
      expect(errorLoop?.confidence).toBeGreaterThan(0.5);
      expect(errorLoop?.details.repetitionCount).toBeGreaterThanOrEqual(5);
    });

    it('should calculate confidence based on error repetition count', async () => {
      // Mock 10 similar errors
      const errors = Array.from({ length: 10 }, (_, i) => ({
        score: 0.9,
        type: 'blocker' as const,
        content: 'ReferenceError: x is not defined',
        timestamp: new Date(Date.now() - (9 - i) * 5 * 60 * 1000).toISOString(),
        metadata: {},
      }));

      vi.mocked(mockCoordinator.search).mockResolvedValue(errors);

      const analysis = await detector.analyze();

      const errorLoop = analysis.patterns.find(p => p.type === 'error_loop');
      expect(errorLoop?.detected).toBe(true);
      // More repetitions = higher confidence
      expect(errorLoop?.confidence).toBeGreaterThan(0.8);
    });

    it('should group similar errors using semantic similarity', async () => {
      // Mock different but related errors
      const errors = [
        {
          score: 0.9,
          type: 'blocker' as const,
          content: 'Cannot read property id of undefined',
          timestamp: '2025-11-09T10:00:00Z',
          metadata: {},
        },
        {
          score: 0.85,
          type: 'blocker' as const,
          content: 'undefined property id read error',
          timestamp: '2025-11-09T10:10:00Z',
          metadata: {},
        },
        {
          score: 0.8,
          type: 'blocker' as const,
          content: 'property id undefined cannot read',
          timestamp: '2025-11-09T10:20:00Z',
          metadata: {},
        },
        {
          score: 0.75,
          type: 'blocker' as const,
          content: 'read id property undefined',
          timestamp: '2025-11-09T10:30:00Z',
          metadata: {},
        },
        {
          score: 0.7,
          type: 'blocker' as const,
          content: 'Cannot read id undefined property',
          timestamp: '2025-11-09T10:40:00Z',
          metadata: {},
        },
      ];

      vi.mocked(mockCoordinator.search).mockResolvedValue(errors);

      const analysis = await detector.analyze();

      const errorLoop = analysis.patterns.find(p => p.type === 'error_loop');
      expect(errorLoop?.detected).toBe(true);
    });
  });

  describe('Cooldown Mechanism', () => {
    it('should not be in cooldown initially', async () => {
      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue([]);
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);

      const analysis = await detector.analyze();

      expect(analysis.cooldownActive).toBe(false);
      expect(analysis.lastAlertTime).toBeNull();
    });

    it('should activate cooldown when stuck is detected', async () => {
      // Mock repeated blocker (stuck)
      const blockers = Array.from({ length: 4 }, (_, i) => ({
        score: 1.0,
        type: 'blocker' as const,
        content: 'Database connection failing',
        timestamp: new Date(Date.now() - (3 - i) * 15 * 60 * 1000).toISOString(),
        metadata: {},
      }));

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);

      const analysis = await detector.analyze();

      expect(analysis.stuck).toBe(true);
      expect(analysis.lastAlertTime).not.toBeNull();
    });

    it('should allow manual cooldown reset', async () => {
      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue([]);

      // First analysis - trigger alert
      const blockers = Array.from({ length: 3 }, () => ({
        score: 1.0,
        type: 'blocker' as const,
        content: 'Test blocker',
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);
      await detector.analyze();

      // Reset cooldown
      detector.resetCooldown();

      // Second analysis - cooldown should be cleared
      const analysis = await detector.analyze();
      expect(analysis.lastAlertTime).toBeNull();
    });
  });

  describe('Overall Analysis', () => {
    it('should run all detection types in parallel', async () => {
      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue([]);
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const analysis = await detector.analyze();

      expect(analysis.patterns).toHaveLength(3);
      expect(analysis.patterns[0].type).toBe('repeated_blocker');
      expect(analysis.patterns[1].type).toBe('no_progress');
      expect(analysis.patterns[2].type).toBe('error_loop');
    });

    it('should calculate overall confidence as average of detected patterns', async () => {
      // Mock 2 stuck patterns
      const blockers = Array.from({ length: 4 }, () => ({
        score: 1.0,
        type: 'blocker' as const,
        content: 'Same blocker',
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      const errors = Array.from({ length: 6 }, () => ({
        score: 0.9,
        type: 'blocker' as const,
        content: 'Same error',
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);
      vi.mocked(mockCoordinator.search).mockResolvedValue(errors);

      const analysis = await detector.analyze();

      const detectedCount = analysis.patterns.filter(p => p.detected).length;
      expect(detectedCount).toBeGreaterThan(0);
      expect(analysis.overallConfidence).toBeGreaterThan(0);
    });

    it('should mark as stuck when confidence >= 0.5', async () => {
      // Mock high-confidence stuck pattern
      const blockers = Array.from({ length: 5 }, () => ({
        score: 1.0,
        type: 'blocker' as const,
        content: 'Persistent blocker',
        timestamp: new Date().toISOString(),
        metadata: {},
      }));

      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue(blockers);

      const analysis = await detector.analyze();

      expect(analysis.stuck).toBe(true);
      expect(analysis.overallConfidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should not mark as stuck when confidence < 0.5', async () => {
      // Mock low-confidence (no patterns detected)
      vi.mocked(mockCoordinator.getNotesByType).mockResolvedValue([]);
      vi.mocked(mockCoordinator.search).mockResolvedValue([]);

      const analysis = await detector.analyze();

      expect(analysis.stuck).toBe(false);
      expect(analysis.overallConfidence).toBe(0);
    });
  });
});
