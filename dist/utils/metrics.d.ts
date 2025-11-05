export interface CompressionMetrics {
    sessionId: string;
    project: string;
    date: string;
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    savings: number;
}
export interface PatternReuseMetrics {
    patternId: string;
    category: string;
    reuseCount: number;
    projects: string[];
    firstUsed: string;
    lastUsed: string;
    avgQuality?: number;
}
export declare function calculateCompressionRatio(projectPath: string, sessionId: string): Promise<CompressionMetrics | null>;
export declare function getProjectCompressionMetrics(projectPath: string): Promise<CompressionMetrics[]>;
export declare function trackPatternReuse(patternId: string): Promise<PatternReuseMetrics | null>;
export declare function getAllPatternReuseMetrics(): Promise<PatternReuseMetrics[]>;
export declare function calculateAggregateCompression(projectPath: string): Promise<{
    totalSessions: number;
    avgCompressionRatio: number;
    totalTokensSaved: number;
    bestCompression: CompressionMetrics | null;
    worstCompression: CompressionMetrics | null;
}>;
//# sourceMappingURL=metrics.d.ts.map