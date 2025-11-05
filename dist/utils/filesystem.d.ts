export interface PatternMetadata {
    id: string;
    name: string;
    category: string;
    quality?: number;
    hasExecutable: boolean;
    description: string;
    path: string;
}
export declare function getSharedPatternsPath(): string;
export declare function getPatternCategories(): Promise<string[]>;
export declare function searchPatternsInCategory(category: string, keyword?: string, includeExecutable?: boolean): Promise<PatternMetadata[]>;
//# sourceMappingURL=filesystem.d.ts.map