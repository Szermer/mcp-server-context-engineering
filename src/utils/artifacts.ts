/**
 * Artifacts utilities for finalization pack access
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

export interface SessionMetadata {
  sessionId: string;
  date: string;
  project: string;
  title: string;
  summary: string;
  path: string;
  hasCode: boolean;
}

export interface SessionArtifact {
  sessionId: string;
  date: string;
  project: string;
  content: {
    summary: string;
    decisions: string[];
    implementations: string[];
    challenges: string[];
    nextSteps: string[];
  };
  codeBlocks?: Array<{
    language: string;
    code: string;
    file?: string;
  }>;
}

/**
 * Get all project directories with artifacts
 */
export async function getProjectsWithArtifacts(): Promise<string[]> {
  const devDir = path.join(homedir(), 'Dev');
  const projects: string[] = [];

  try {
    const entries = await fs.readdir(devDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const artifactsPath = path.join(devDir, entry.name, '.agent-artifacts');
        try {
          await fs.access(artifactsPath);
          projects.push(entry.name);
        } catch {
          // Project doesn't have artifacts
        }
      }
    }

    return projects;
  } catch {
    return [];
  }
}

/**
 * Search artifacts across projects
 */
export async function searchArtifactsInProjects(
  keyword?: string,
  project?: string,
  limit?: number
): Promise<SessionMetadata[]> {
  const devDir = path.join(homedir(), 'Dev');
  const results: SessionMetadata[] = [];

  // Get projects to search
  const projectsToSearch = project
    ? [project]
    : await getProjectsWithArtifacts();

  for (const projectName of projectsToSearch) {
    const artifactsPath = path.join(devDir, projectName, '.agent-artifacts');

    try {
      const entries = await fs.readdir(artifactsPath, { withFileTypes: true });

      for (const entry of entries) {
        // Check flat file structure (backwards compatibility)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const sessionPath = path.join(artifactsPath, entry.name);
          const content = await fs.readFile(sessionPath, 'utf-8');

          // Extract session metadata
          const sessionId = entry.name.replace('.md', '');
          const date = extractDate(sessionId) || 'unknown';
          const title = extractTitle(content);
          const summary = extractSummary(content);
          const hasCode = content.includes('```');

          // Filter by keyword if provided
          if (keyword) {
            const searchText = `${title} ${summary} ${content}`.toLowerCase();
            if (!searchText.includes(keyword.toLowerCase())) {
              continue;
            }
          }

          results.push({
            sessionId,
            date,
            project: projectName,
            title,
            summary,
            path: sessionPath,
            hasCode,
          });
        }

        // Check directory-based structure (primary format)
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const sessionDir = path.join(artifactsPath, entry.name);

          // Look for session-summary.md or finalization-pack.json
          const summaryPath = path.join(sessionDir, 'session-summary.md');
          const packPath = path.join(sessionDir, 'finalization-pack.json');

          try {
            let content = '';
            let sessionPath = '';

            // Try to read session-summary.md first
            try {
              content = await fs.readFile(summaryPath, 'utf-8');
              sessionPath = summaryPath;
            } catch {
              // Fall back to finalization-pack.json
              try {
                const packContent = await fs.readFile(packPath, 'utf-8');
                const pack = JSON.parse(packContent);
                // Convert JSON pack to searchable text
                content = JSON.stringify(pack, null, 2);
                sessionPath = packPath;
              } catch {
                // No valid session file found
                continue;
              }
            }

            const sessionId = entry.name;
            const date = extractDate(sessionId) || 'unknown';
            const title = extractTitle(content);
            const summary = extractSummary(content);
            const hasCode = content.includes('```') || content.includes('"code"');

            // Filter by keyword if provided
            if (keyword) {
              const searchText = `${title} ${summary} ${content}`.toLowerCase();
              if (!searchText.includes(keyword.toLowerCase())) {
                continue;
              }
            }

            results.push({
              sessionId,
              date,
              project: projectName,
              title,
              summary,
              path: sessionPath,
              hasCode,
            });
          } catch {
            // Session directory not accessible or invalid
            continue;
          }
        }
      }
    } catch {
      // Project artifacts directory not accessible
      continue;
    }
  }

  // Sort by date (newest first)
  results.sort((a, b) => b.date.localeCompare(a.date));

  // Apply limit
  return limit ? results.slice(0, limit) : results;
}

/**
 * Load complete session artifact
 */
export async function loadSessionArtifact(
  project: string,
  sessionId: string
): Promise<SessionArtifact | null> {
  const devDir = path.join(homedir(), 'Dev');
  const artifactsDir = path.join(devDir, project, '.agent-artifacts');

  // Try directory-based structure first (primary format)
  const sessionDir = path.join(artifactsDir, sessionId);
  const summaryPath = path.join(sessionDir, 'session-summary.md');
  const packPath = path.join(sessionDir, 'finalization-pack.json');

  try {
    // Try to read session-summary.md
    try {
      const content = await fs.readFile(summaryPath, 'utf-8');

      return {
        sessionId,
        date: extractDate(sessionId) || 'unknown',
        project,
        content: {
          summary: extractSummary(content),
          decisions: extractSection(content, 'Decisions'),
          implementations: extractSection(content, 'Implementations'),
          challenges: extractSection(content, 'Challenges'),
          nextSteps: extractSection(content, 'Next Steps'),
        },
        codeBlocks: extractCodeBlocks(content),
      };
    } catch {
      // Try finalization-pack.json
      try {
        const packContent = await fs.readFile(packPath, 'utf-8');
        const pack = JSON.parse(packContent);

        // Extract data from finalization pack
        return {
          sessionId,
          date: pack.metadata?.date || extractDate(sessionId) || 'unknown',
          project,
          content: {
            summary: pack.summary || 'No summary available',
            decisions: pack.decisions || [],
            implementations: pack.implementations || [],
            challenges: pack.challenges || [],
            nextSteps: pack.nextSteps || pack.next_steps || [],
          },
          codeBlocks: pack.codeBlocks || pack.code_blocks || [],
        };
      } catch {
        // Fall back to flat file structure
        const flatPath = path.join(artifactsDir, `${sessionId}.md`);
        try {
          const content = await fs.readFile(flatPath, 'utf-8');

          return {
            sessionId,
            date: extractDate(sessionId) || 'unknown',
            project,
            content: {
              summary: extractSummary(content),
              decisions: extractSection(content, 'Decisions'),
              implementations: extractSection(content, 'Implementations'),
              challenges: extractSection(content, 'Challenges'),
              nextSteps: extractSection(content, 'Next Steps'),
            },
            codeBlocks: extractCodeBlocks(content),
          };
        } catch {
          return null;
        }
      }
    }
  } catch {
    return null;
  }
}

/**
 * Extract code blocks from session
 */
export async function extractSessionCode(
  project: string,
  sessionId: string,
  language?: string
): Promise<Array<{ language: string; code: string; file?: string }>> {
  const artifact = await loadSessionArtifact(project, sessionId);

  if (!artifact || !artifact.codeBlocks) {
    return [];
  }

  // Filter by language if specified
  if (language) {
    return artifact.codeBlocks.filter(
      (block) => block.language.toLowerCase() === language.toLowerCase()
    );
  }

  return artifact.codeBlocks;
}

// Helper functions

function extractDate(sessionId: string): string | null {
  // Extract date from format: YYYY-MM-DD-description
  const match = sessionId.match(/^(\d{4}-\d{2}-\d{2})/);
  return match && match[1] ? match[1] : null;
}

function extractTitle(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      return trimmed.replace(/^#\s+/, '');
    }
  }
  return 'Untitled Session';
}

function extractSummary(content: string): string {
  // Look for ## Summary section
  const summaryMatch = content.match(/##\s*Summary\s*\n\n(.*?)(?=\n##|\n\n##|$)/s);
  if (summaryMatch && summaryMatch[1]) {
    return summaryMatch[1].trim().slice(0, 300);
  }

  // Fall back to first paragraph
  const paragraphMatch = content.match(/^#.*?\n\n(.*?)(?=\n##|$)/s);
  if (paragraphMatch && paragraphMatch[1]) {
    return paragraphMatch[1].trim().slice(0, 300);
  }

  return 'No summary available';
}

function extractSection(content: string, sectionName: string): string[] {
  const regex = new RegExp(
    `##\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`,
    'i'
  );
  const match = content.match(regex);

  if (!match || !match[1]) {
    return [];
  }

  const sectionContent = match[1].trim();
  const lines = sectionContent.split('\n');
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      items.push(trimmed.replace(/^[-*]\s+/, ''));
    }
  }

  return items;
}

function extractCodeBlocks(
  content: string
): Array<{ language: string; code: string; file?: string }> {
  const codeBlocks: Array<{ language: string; code: string; file?: string }> = [];
  const regex = /```(\w+)(?:\s+(.+?))?\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const language = match[1] || 'text';
    const file = match[2]; // Optional file path
    const code = match[3]?.trim() || '';

    if (code) {
      codeBlocks.push({
        language,
        code,
        file,
      });
    }
  }

  return codeBlocks;
}
