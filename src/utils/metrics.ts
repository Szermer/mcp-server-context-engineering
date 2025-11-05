/**
 * Metrics utilities for compression and pattern reuse tracking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

export interface CompressionMetrics {
  sessionId: string;
  project: string;
  date: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number; // Percentage
  savings: number; // Token count saved
}

export interface PatternReuseMetrics {
  patternId: string;
  category: string;
  reuseCount: number;
  projects: string[];
  firstUsed: string; // ISO date
  lastUsed: string; // ISO date
  avgQuality?: number;
}

/**
 * Calculate compression ratio for a session
 */
export async function calculateCompressionRatio(
  projectPath: string,
  sessionId: string
): Promise<CompressionMetrics | null> {
  const metricsPath = path.join(
    projectPath,
    '.agent-artifacts',
    `${sessionId}.metrics.json`
  );

  try {
    const content = await fs.readFile(metricsPath, 'utf-8');
    const metrics = JSON.parse(content);

    // Extract token counts from metrics file
    const originalTokens = metrics.tokens?.original || 0;
    const compressedTokens = metrics.tokens?.compressed || 0;

    if (originalTokens === 0) {
      return null;
    }

    const compressionRatio =
      ((originalTokens - compressedTokens) / originalTokens) * 100;
    const savings = originalTokens - compressedTokens;

    return {
      sessionId,
      project: path.basename(projectPath),
      date: extractDate(sessionId) || 'unknown',
      originalTokens,
      compressedTokens,
      compressionRatio,
      savings,
    };
  } catch {
    return null;
  }
}

/**
 * Get compression metrics for all sessions in a project
 */
export async function getProjectCompressionMetrics(
  projectPath: string
): Promise<CompressionMetrics[]> {
  const artifactsPath = path.join(projectPath, '.agent-artifacts');
  const metrics: CompressionMetrics[] = [];

  try {
    const entries = await fs.readdir(artifactsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.metrics.json')) {
        const sessionId = entry.name.replace('.metrics.json', '');
        const sessionMetrics = await calculateCompressionRatio(
          projectPath,
          sessionId
        );

        if (sessionMetrics) {
          metrics.push(sessionMetrics);
        }
      }
    }

    return metrics.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/**
 * Track pattern reuse across projects
 */
export async function trackPatternReuse(
  patternId: string
): Promise<PatternReuseMetrics | null> {
  const devDir = path.join(homedir(), 'Dev');
  const projects: string[] = [];
  const usageDates: string[] = [];

  try {
    const projectDirs = await fs.readdir(devDir, { withFileTypes: true });

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory() || projectDir.name.startsWith('.')) {
        continue;
      }

      const artifactsPath = path.join(
        devDir,
        projectDir.name,
        '.agent-artifacts'
      );

      try {
        const artifacts = await fs.readdir(artifactsPath);

        for (const artifact of artifacts) {
          if (artifact.endsWith('.md')) {
            const artifactPath = path.join(artifactsPath, artifact);
            const content = await fs.readFile(artifactPath, 'utf-8');

            // Check if pattern is mentioned in artifact
            if (content.includes(patternId)) {
              projects.push(projectDir.name);
              const date = extractDate(artifact);
              if (date) {
                usageDates.push(date);
              }
              break; // Count project only once
            }
          }
        }
      } catch {
        // Project doesn't have artifacts
        continue;
      }
    }

    if (projects.length === 0) {
      return null;
    }

    // Sort dates to get first and last usage
    usageDates.sort();

    // Extract category from pattern ID
    const [category] = patternId.split('/');

    return {
      patternId,
      category: category || 'unknown',
      reuseCount: projects.length,
      projects: Array.from(new Set(projects)), // Deduplicate
      firstUsed: usageDates[0] || 'unknown',
      lastUsed: usageDates[usageDates.length - 1] || 'unknown',
    };
  } catch {
    return null;
  }
}

/**
 * Get reuse metrics for all patterns
 */
export async function getAllPatternReuseMetrics(): Promise<PatternReuseMetrics[]> {
  const patternsDir = path.join(homedir(), '.shared-patterns');
  const metrics: PatternReuseMetrics[] = [];

  try {
    const categories = await fs.readdir(patternsDir, { withFileTypes: true });

    for (const category of categories) {
      if (!category.isDirectory() || category.name.startsWith('.')) {
        continue;
      }

      const categoryPath = path.join(patternsDir, category.name);
      const patterns = await fs.readdir(categoryPath);

      for (const pattern of patterns) {
        if (pattern.endsWith('.md') && !pattern.endsWith('-SKILL.md')) {
          const patternName = pattern.replace('.md', '');
          const patternId = `${category.name}/${patternName}`;

          const reuseMetrics = await trackPatternReuse(patternId);
          if (reuseMetrics) {
            metrics.push(reuseMetrics);
          }
        }
      }
    }

    // Sort by reuse count (descending)
    return metrics.sort((a, b) => b.reuseCount - a.reuseCount);
  } catch {
    return [];
  }
}

/**
 * Calculate aggregate compression statistics
 */
export async function calculateAggregateCompression(
  projectPath: string
): Promise<{
  totalSessions: number;
  avgCompressionRatio: number;
  totalTokensSaved: number;
  bestCompression: CompressionMetrics | null;
  worstCompression: CompressionMetrics | null;
}> {
  const metrics = await getProjectCompressionMetrics(projectPath);

  if (metrics.length === 0) {
    return {
      totalSessions: 0,
      avgCompressionRatio: 0,
      totalTokensSaved: 0,
      bestCompression: null,
      worstCompression: null,
    };
  }

  const avgCompressionRatio =
    metrics.reduce((sum, m) => sum + m.compressionRatio, 0) / metrics.length;

  const totalTokensSaved = metrics.reduce((sum, m) => sum + m.savings, 0);

  // Sort by compression ratio
  const sorted = [...metrics].sort(
    (a, b) => b.compressionRatio - a.compressionRatio
  );

  return {
    totalSessions: metrics.length,
    avgCompressionRatio,
    totalTokensSaved,
    bestCompression: sorted[0] || null,
    worstCompression: sorted[sorted.length - 1] || null,
  };
}

// Helper function
function extractDate(filename: string): string | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match && match[1] ? match[1] : null;
}
