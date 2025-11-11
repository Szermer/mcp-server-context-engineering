/**
 * StuckDetector - Detect when developers are stuck during a session
 *
 * Three detection types:
 * 1. Repeated Blocker - Same blocker mentioned 3+ times
 * 2. No Progress - No file changes for 20+ minutes during implementation
 * 3. Error Loop - Same error repeating 5+ times
 *
 * Includes cooldown mechanism (max 1 alert per 10 min) to prevent spam.
 */

import { SessionCoordinator, SearchResult } from './SessionCoordinator.js';
import * as fs from 'fs';
import * as path from 'path';

export interface StuckPattern {
  type: 'repeated_blocker' | 'no_progress' | 'error_loop';
  detected: boolean;
  confidence: number; // 0.0 to 1.0
  details: {
    description: string;
    evidence: string[];
    timeSinceFirst?: string; // For repeated blockers
    idleTime?: string; // For no progress
    repetitionCount?: number; // For error loops
  };
}

export interface StuckAnalysis {
  stuck: boolean;
  patterns: StuckPattern[];
  overallConfidence: number;
  lastAlertTime: string | null;
  cooldownActive: boolean;
}

export class StuckDetector {
  private coordinator: SessionCoordinator;
  private projectPath: string;
  private cooldownMinutes: number = 10;
  private lastAlertTime: Date | null = null;

  // Thresholds
  private readonly BLOCKER_REPEAT_THRESHOLD = 3;
  private readonly NO_PROGRESS_MINUTES = 20;
  private readonly ERROR_REPEAT_THRESHOLD = 5;
  private readonly SIMILARITY_THRESHOLD = 0.7; // For detecting "same" blocker/error

  constructor(coordinator: SessionCoordinator, projectPath: string) {
    this.coordinator = coordinator;
    this.projectPath = projectPath;
  }

  /**
   * Run all detection types and return comprehensive analysis
   */
  async analyze(): Promise<StuckAnalysis> {
    // Check cooldown
    const cooldownActive = this.isCooldownActive();

    // Run all detection types in parallel
    const [repeatedBlocker, noProgress, errorLoop] = await Promise.all([
      this.detectRepeatedBlocker(),
      this.detectNoProgress(),
      this.detectErrorLoop(),
    ]);

    const patterns = [repeatedBlocker, noProgress, errorLoop];
    const detectedPatterns = patterns.filter(p => p.detected);

    // Calculate overall confidence (average of detected patterns)
    const overallConfidence = detectedPatterns.length > 0
      ? detectedPatterns.reduce((sum, p) => sum + p.confidence, 0) / detectedPatterns.length
      : 0;

    const stuck = detectedPatterns.length > 0 && overallConfidence >= 0.5;

    // Update last alert time if stuck and not in cooldown
    if (stuck && !cooldownActive) {
      this.lastAlertTime = new Date();
    }

    return {
      stuck,
      patterns,
      overallConfidence,
      lastAlertTime: this.lastAlertTime?.toISOString() || null,
      cooldownActive,
    };
  }

  /**
   * Type 1: Detect repeated blocker (same blocker mentioned 3+ times)
   */
  private async detectRepeatedBlocker(): Promise<StuckPattern> {
    try {
      // Get all blocker notes from session
      const blockers = await this.coordinator.getNotesByType('blocker');

      if (blockers.length < this.BLOCKER_REPEAT_THRESHOLD) {
        return {
          type: 'repeated_blocker',
          detected: false,
          confidence: 0,
          details: {
            description: 'No repeated blockers detected',
            evidence: [],
          },
        };
      }

      // Group similar blockers by semantic similarity
      const blockerGroups = this.groupSimilarBlockers(blockers);

      // Find groups with 3+ occurrences
      const repeatedGroups = blockerGroups.filter(
        group => group.blockers.length >= this.BLOCKER_REPEAT_THRESHOLD
      );

      if (repeatedGroups.length === 0) {
        return {
          type: 'repeated_blocker',
          detected: false,
          confidence: 0,
          details: {
            description: 'No repeated blockers detected',
            evidence: [],
          },
        };
      }

      // Get the most repeated blocker group
      const mostRepeated = repeatedGroups.reduce((max, group) =>
        group.blockers.length > max.blockers.length ? group : max
      );

      const firstBlocker = mostRepeated.blockers[0];
      const lastBlocker = mostRepeated.blockers[mostRepeated.blockers.length - 1];

      if (!firstBlocker || !lastBlocker) {
        return {
          type: 'repeated_blocker',
          detected: false,
          confidence: 0,
          details: {
            description: 'Error: Invalid blocker data',
            evidence: [],
          },
        };
      }

      const firstTime = new Date(firstBlocker.timestamp);
      const lastTime = new Date(lastBlocker.timestamp);
      const timeSinceFirst = this.formatDuration(lastTime.getTime() - firstTime.getTime());

      // Calculate confidence based on repetition count and time span
      const repetitionCount = mostRepeated.blockers.length;
      const timeSpanMinutes =
        (lastTime.getTime() - firstTime.getTime()) / (1000 * 60);
      const confidence = Math.min(
        0.5 + (repetitionCount / 10) + (timeSpanMinutes / 60),
        1.0
      );

      return {
        type: 'repeated_blocker',
        detected: true,
        confidence,
        details: {
          description: `Blocker mentioned ${repetitionCount} times over ${timeSinceFirst}`,
          evidence: mostRepeated.blockers.map(
            b => `[${new Date(b.timestamp).toLocaleTimeString()}] ${b.content}`
          ),
          timeSinceFirst,
        },
      };
    } catch (error: any) {
      console.error(`❌ Failed to detect repeated blocker: ${error.message}`);
      return {
        type: 'repeated_blocker',
        detected: false,
        confidence: 0,
        details: {
          description: 'Error during detection',
          evidence: [],
        },
      };
    }
  }

  /**
   * Type 2: Detect no progress (no file changes for 20+ minutes)
   */
  private async detectNoProgress(): Promise<StuckPattern> {
    try {
      // Get last modified time of files in project
      const lastModified = await this.getLastFileModifiedTime(this.projectPath);

      if (!lastModified) {
        return {
          type: 'no_progress',
          detected: false,
          confidence: 0,
          details: {
            description: 'Unable to determine file modification times',
            evidence: [],
          },
        };
      }

      const now = Date.now();
      const idleTimeMs = now - lastModified;
      const idleMinutes = idleTimeMs / (1000 * 60);

      if (idleMinutes < this.NO_PROGRESS_MINUTES) {
        return {
          type: 'no_progress',
          detected: false,
          confidence: 0,
          details: {
            description: `Files modified ${Math.floor(idleMinutes)} minutes ago (active)`,
            evidence: [],
            idleTime: this.formatDuration(idleTimeMs),
          },
        };
      }

      // Calculate confidence based on idle time
      // 20 min = 0.5, 40 min = 0.75, 60+ min = 1.0
      const confidence = Math.min(0.5 + (idleMinutes - 20) / 80, 1.0);

      return {
        type: 'no_progress',
        detected: true,
        confidence,
        details: {
          description: `No file changes for ${Math.floor(idleMinutes)} minutes`,
          evidence: [
            `Last file modification: ${new Date(lastModified).toLocaleTimeString()}`,
            `Current time: ${new Date(now).toLocaleTimeString()}`,
          ],
          idleTime: this.formatDuration(idleTimeMs),
        },
      };
    } catch (error: any) {
      console.error(`❌ Failed to detect no progress: ${error.message}`);
      return {
        type: 'no_progress',
        detected: false,
        confidence: 0,
        details: {
          description: 'Error during detection',
          evidence: [],
        },
      };
    }
  }

  /**
   * Type 3: Detect error loop (same error repeating 5+ times)
   */
  private async detectErrorLoop(): Promise<StuckPattern> {
    try {
      // Search for error-related notes
      const errorResults = await this.coordinator.search('error failed exception bug', 20);

      if (errorResults.length < this.ERROR_REPEAT_THRESHOLD) {
        return {
          type: 'error_loop',
          detected: false,
          confidence: 0,
          details: {
            description: 'No error loops detected',
            evidence: [],
          },
        };
      }

      // Group similar errors by semantic similarity
      const errorGroups = this.groupSimilarErrors(errorResults);

      // Find groups with 5+ occurrences
      const repeatedErrors = errorGroups.filter(
        group => group.errors.length >= this.ERROR_REPEAT_THRESHOLD
      );

      if (repeatedErrors.length === 0) {
        return {
          type: 'error_loop',
          detected: false,
          confidence: 0,
          details: {
            description: 'No error loops detected',
            evidence: [],
          },
        };
      }

      // Get the most repeated error group
      const mostRepeated = repeatedErrors.reduce((max, group) =>
        group.errors.length > max.errors.length ? group : max
      );

      const repetitionCount = mostRepeated.errors.length;

      // Calculate confidence based on repetition count
      const confidence = Math.min(0.5 + (repetitionCount / 15), 1.0);

      return {
        type: 'error_loop',
        detected: true,
        confidence,
        details: {
          description: `Same error occurred ${repetitionCount} times`,
          evidence: mostRepeated.errors.slice(0, 5).map(
            e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.content.slice(0, 100)}...`
          ),
          repetitionCount,
        },
      };
    } catch (error: any) {
      console.error(`❌ Failed to detect error loop: ${error.message}`);
      return {
        type: 'error_loop',
        detected: false,
        confidence: 0,
        details: {
          description: 'Error during detection',
          evidence: [],
        },
      };
    }
  }

  /**
   * Group similar blockers by semantic similarity
   */
  private groupSimilarBlockers(blockers: SearchResult[]): Array<{
    representative: string;
    blockers: SearchResult[];
  }> {
    const groups: Array<{ representative: string; blockers: SearchResult[] }> = [];

    for (const blocker of blockers) {
      // Find existing group this blocker belongs to
      let foundGroup = false;
      for (const group of groups) {
        if (this.isSimilar(blocker.content, group.representative)) {
          group.blockers.push(blocker);
          foundGroup = true;
          break;
        }
      }

      // Create new group if no match
      if (!foundGroup) {
        groups.push({
          representative: blocker.content,
          blockers: [blocker],
        });
      }
    }

    return groups;
  }

  /**
   * Group similar errors by semantic similarity
   */
  private groupSimilarErrors(errors: SearchResult[]): Array<{
    representative: string;
    errors: SearchResult[];
  }> {
    const groups: Array<{ representative: string; errors: SearchResult[] }> = [];

    for (const error of errors) {
      // Find existing group this error belongs to
      let foundGroup = false;
      for (const group of groups) {
        if (this.isSimilar(error.content, group.representative)) {
          group.errors.push(error);
          foundGroup = true;
          break;
        }
      }

      // Create new group if no match
      if (!foundGroup) {
        groups.push({
          representative: error.content,
          errors: [error],
        });
      }
    }

    return groups;
  }

  /**
   * Check if two texts are similar (simple text-based similarity)
   */
  private isSimilar(text1: string, text2: string): boolean {
    const normalize = (text: string) =>
      text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

    const words1 = new Set(normalize(text1).split(/\s+/));
    const words2 = new Set(normalize(text2).split(/\s+/));

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;
    return similarity >= this.SIMILARITY_THRESHOLD;
  }

  /**
   * Get last modified time of any file in project (recursive)
   */
  private async getLastFileModifiedTime(dirPath: string): Promise<number | null> {
    try {
      let latestTime = 0;

      const scanDirectory = async (currentPath: string): Promise<void> => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          // Skip common ignored directories
          if (
            entry.isDirectory() &&
            [
              'node_modules',
              '.git',
              'dist',
              'build',
              '.next',
              'coverage',
              '.agent-memory',
              '.agent-artifacts',
            ].includes(entry.name)
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else {
            const stats = fs.statSync(fullPath);
            if (stats.mtimeMs > latestTime) {
              latestTime = stats.mtimeMs;
            }
          }
        }
      };

      await scanDirectory(dirPath);

      return latestTime > 0 ? latestTime : null;
    } catch (error: any) {
      console.error(`❌ Failed to scan directory: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if cooldown is active
   */
  private isCooldownActive(): boolean {
    if (!this.lastAlertTime) return false;

    const now = Date.now();
    const timeSinceLastAlert = now - this.lastAlertTime.getTime();
    const cooldownMs = this.cooldownMinutes * 60 * 1000;

    return timeSinceLastAlert < cooldownMs;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Reset cooldown (for testing)
   */
  public resetCooldown(): void {
    this.lastAlertTime = null;
  }
}
