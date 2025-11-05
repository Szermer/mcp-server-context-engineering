import * as fs from 'fs/promises';
import * as path from 'path';
export function getMemoryPath(projectPath) {
    return path.join(projectPath, '.agent-memory', 'session-notes.jsonl');
}
async function ensureMemoryDir(projectPath) {
    const memoryDir = path.join(projectPath, '.agent-memory');
    await fs.mkdir(memoryDir, { recursive: true });
}
export async function addMemoryNote(projectPath, type, content) {
    await ensureMemoryDir(projectPath);
    const note = {
        type,
        content,
        timestamp: new Date().toISOString(),
    };
    const memoryPath = getMemoryPath(projectPath);
    const line = JSON.stringify(note) + '\n';
    await fs.appendFile(memoryPath, line, 'utf-8');
    return note;
}
export async function readMemoryNotes(projectPath) {
    const memoryPath = getMemoryPath(projectPath);
    try {
        const content = await fs.readFile(memoryPath, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        return lines.map((line) => JSON.parse(line));
    }
    catch (error) {
        return [];
    }
}
export async function getMemoryNotesByType(projectPath, type) {
    const allNotes = await readMemoryNotes(projectPath);
    return allNotes.filter((note) => note.type === type);
}
export async function getDecisions(projectPath) {
    const notes = await getMemoryNotesByType(projectPath, 'decision');
    return notes.map((note) => note.content);
}
export async function getHypotheses(projectPath) {
    const notes = await getMemoryNotesByType(projectPath, 'hypothesis');
    return notes.map((note) => note.content);
}
export async function getBlockers(projectPath) {
    const notes = await getMemoryNotesByType(projectPath, 'blocker');
    return notes.map((note) => note.content);
}
export async function clearMemory(projectPath) {
    const memoryPath = getMemoryPath(projectPath);
    try {
        await fs.unlink(memoryPath);
    }
    catch {
    }
}
export async function getMemoryStats(projectPath) {
    const notes = await readMemoryNotes(projectPath);
    return {
        total: notes.length,
        decisions: notes.filter((n) => n.type === 'decision').length,
        hypotheses: notes.filter((n) => n.type === 'hypothesis').length,
        blockers: notes.filter((n) => n.type === 'blocker').length,
        general: notes.filter((n) => n.type === 'general').length,
    };
}
//# sourceMappingURL=memory.js.map