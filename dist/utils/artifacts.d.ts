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
export declare function getProjectsWithArtifacts(): Promise<string[]>;
export declare function searchArtifactsInProjects(keyword?: string, project?: string, limit?: number): Promise<SessionMetadata[]>;
export declare function loadSessionArtifact(project: string, sessionId: string): Promise<SessionArtifact | null>;
export declare function extractSessionCode(project: string, sessionId: string, language?: string): Promise<Array<{
    language: string;
    code: string;
    file?: string;
}>>;
//# sourceMappingURL=artifacts.d.ts.map