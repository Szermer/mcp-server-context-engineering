/**
 * Memory utilities for session runtime context
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type NoteType = 'decision' | 'hypothesis' | 'blocker' | 'general';

export interface Note {
  type: NoteType;
  content: string;
  timestamp: string;
}

/**
 * Get the memory file path for a project
 */
export function getMemoryPath(projectPath: string): string {
  return path.join(projectPath, '.agent-memory', 'session-notes.jsonl');
}

/**
 * Ensure memory directory exists
 */
async function ensureMemoryDir(projectPath: string): Promise<void> {
  const memoryDir = path.join(projectPath, '.agent-memory');
  await fs.mkdir(memoryDir, { recursive: true });
}

/**
 * Add a note to session memory
 */
export async function addMemoryNote(
  projectPath: string,
  type: NoteType,
  content: string
): Promise<Note> {
  await ensureMemoryDir(projectPath);

  const note: Note = {
    type,
    content,
    timestamp: new Date().toISOString(),
  };

  const memoryPath = getMemoryPath(projectPath);
  const line = JSON.stringify(note) + '\n';

  await fs.appendFile(memoryPath, line, 'utf-8');

  return note;
}

/**
 * Read all notes from session memory
 */
export async function readMemoryNotes(projectPath: string): Promise<Note[]> {
  const memoryPath = getMemoryPath(projectPath);

  try {
    const content = await fs.readFile(memoryPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    return lines.map((line) => JSON.parse(line) as Note);
  } catch (error) {
    // Memory file doesn't exist yet
    return [];
  }
}

/**
 * Get notes of specific type
 */
export async function getMemoryNotesByType(
  projectPath: string,
  type: NoteType
): Promise<Note[]> {
  const allNotes = await readMemoryNotes(projectPath);
  return allNotes.filter((note) => note.type === type);
}

/**
 * Get decision notes
 */
export async function getDecisions(projectPath: string): Promise<string[]> {
  const notes = await getMemoryNotesByType(projectPath, 'decision');
  return notes.map((note) => note.content);
}

/**
 * Get hypothesis notes
 */
export async function getHypotheses(projectPath: string): Promise<string[]> {
  const notes = await getMemoryNotesByType(projectPath, 'hypothesis');
  return notes.map((note) => note.content);
}

/**
 * Get blocker notes
 */
export async function getBlockers(projectPath: string): Promise<string[]> {
  const notes = await getMemoryNotesByType(projectPath, 'blocker');
  return notes.map((note) => note.content);
}

/**
 * Clear session memory (use with caution)
 */
export async function clearMemory(projectPath: string): Promise<void> {
  const memoryPath = getMemoryPath(projectPath);

  try {
    await fs.unlink(memoryPath);
  } catch {
    // File doesn't exist, nothing to clear
  }
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(
  projectPath: string
): Promise<{
  total: number;
  decisions: number;
  hypotheses: number;
  blockers: number;
  general: number;
}> {
  const notes = await readMemoryNotes(projectPath);

  return {
    total: notes.length,
    decisions: notes.filter((n) => n.type === 'decision').length,
    hypotheses: notes.filter((n) => n.type === 'hypothesis').length,
    blockers: notes.filter((n) => n.type === 'blocker').length,
    general: notes.filter((n) => n.type === 'general').length,
  };
}
