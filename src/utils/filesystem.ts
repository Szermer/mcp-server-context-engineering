/**
 * Filesystem utilities for context engineering operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

export interface PatternMetadata {
  id: string;
  name: string;
  category: string;
  quality?: number;
  hasExecutable: boolean;
  description: string;
  path: string;
}

/**
 * Get the shared patterns directory path
 */
export function getSharedPatternsPath(): string {
  return path.join(homedir(), '.shared-patterns');
}

/**
 * Get the patterns subdirectory path (contains category folders)
 */
export function getPatternsBasePath(): string {
  return path.join(getSharedPatternsPath(), 'patterns');
}

/**
 * Get all pattern categories
 */
export async function getPatternCategories(): Promise<string[]> {
  const patternsDir = getPatternsBasePath();

  try {
    const entries = await fs.readdir(patternsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('.'));
  } catch (error) {
    // Patterns directory might not exist yet
    return [];
  }
}

/**
 * Search for patterns in a specific category
 */
export async function searchPatternsInCategory(
  category: string,
  keyword?: string,
  includeExecutable?: boolean
): Promise<PatternMetadata[]> {
  const categoryPath = path.join(getPatternsBasePath(), category);

  try {
    const entries = await fs.readdir(categoryPath, { withFileTypes: true });
    const patterns: PatternMetadata[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('-SKILL.md')) {
        const baseName = entry.name.replace('.md', '');
        const fullPath = path.join(categoryPath, entry.name);

        // Check if there's an executable file
        const tsPath = path.join(categoryPath, `${baseName}.ts`);
        const hasExecutable = await fileExists(tsPath);

        // Filter by includeExecutable if specified
        if (includeExecutable === true && !hasExecutable) {
          continue;
        }

        // Read SKILL.md if it exists
        const skillPath = path.join(categoryPath, `${baseName}-SKILL.md`);
        let quality: number | undefined;
        let description = '';

        if (await fileExists(skillPath)) {
          const skillContent = await fs.readFile(skillPath, 'utf-8');
          quality = extractQualityScore(skillContent);
          description = extractDescription(skillContent);
        } else {
          // Fall back to reading description from main .md file
          const mdContent = await fs.readFile(fullPath, 'utf-8');
          description = extractFirstParagraph(mdContent);
        }

        // Filter by keyword if specified
        if (keyword) {
          const searchText = `${baseName} ${description}`.toLowerCase();
          if (!searchText.includes(keyword.toLowerCase())) {
            continue;
          }
        }

        patterns.push({
          id: `${category}/${baseName}`,
          name: baseName,
          category,
          quality,
          hasExecutable,
          description,
          path: fullPath,
        });
      }
    }

    return patterns;
  } catch (error) {
    // Category might not exist
    return [];
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract quality score from SKILL.md content
 */
function extractQualityScore(content: string): number | undefined {
  // Match "**Quality Score:** 8.5/10" format
  const match = content.match(/\*\*Quality Score:\*\*\s*(\d+(?:\.\d+)?)(?:\/10)?/i);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return undefined;
}

/**
 * Extract description from SKILL.md content
 */
function extractDescription(content: string): string {
  // Look for ## Overview section
  const overviewMatch = content.match(/##\s*Overview\s*\n\n(.*?)(?=\n##|\n\n##|$)/s);
  if (overviewMatch && overviewMatch[1]) {
    return overviewMatch[1].trim().slice(0, 200);
  }

  // Fall back to first paragraph after title
  return extractFirstParagraph(content);
}

/**
 * Extract first meaningful paragraph from markdown content
 */
function extractFirstParagraph(content: string): string {
  const lines = content.split('\n');
  let foundTitle = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip until we find the title
    if (!foundTitle) {
      if (trimmed.startsWith('#')) {
        foundTitle = true;
      }
      continue;
    }

    // Skip empty lines and metadata
    if (trimmed === '' || trimmed.startsWith('**') || trimmed.startsWith('*')) {
      continue;
    }

    // Return first meaningful paragraph
    if (trimmed.length > 0) {
      return trimmed.slice(0, 200);
    }
  }

  return 'No description available';
}
