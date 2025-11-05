export type NoteType = 'decision' | 'hypothesis' | 'blocker' | 'general';
export interface Note {
    type: NoteType;
    content: string;
    timestamp: string;
}
export declare function getMemoryPath(projectPath: string): string;
export declare function addMemoryNote(projectPath: string, type: NoteType, content: string): Promise<Note>;
export declare function readMemoryNotes(projectPath: string): Promise<Note[]>;
export declare function getMemoryNotesByType(projectPath: string, type: NoteType): Promise<Note[]>;
export declare function getDecisions(projectPath: string): Promise<string[]>;
export declare function getHypotheses(projectPath: string): Promise<string[]>;
export declare function getBlockers(projectPath: string): Promise<string[]>;
export declare function clearMemory(projectPath: string): Promise<void>;
export declare function getMemoryStats(projectPath: string): Promise<{
    total: number;
    decisions: number;
    hypotheses: number;
    blockers: number;
    general: number;
}>;
//# sourceMappingURL=memory.d.ts.map