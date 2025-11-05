import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
export async function calculateCompressionRatio(projectPath, sessionId) {
    const metricsPath = path.join(projectPath, '.agent-artifacts', `${sessionId}.metrics.json`);
    try {
        const content = await fs.readFile(metricsPath, 'utf-8');
        const metrics = JSON.parse(content);
        const originalTokens = metrics.tokens?.original || 0;
        const compressedTokens = metrics.tokens?.compressed || 0;
        if (originalTokens === 0) {
            return null;
        }
        const compressionRatio = ((originalTokens - compressedTokens) / originalTokens) * 100;
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
    }
    catch {
        return null;
    }
}
export async function getProjectCompressionMetrics(projectPath) {
    const artifactsPath = path.join(projectPath, '.agent-artifacts');
    const metrics = [];
    try {
        const entries = await fs.readdir(artifactsPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.metrics.json')) {
                const sessionId = entry.name.replace('.metrics.json', '');
                const sessionMetrics = await calculateCompressionRatio(projectPath, sessionId);
                if (sessionMetrics) {
                    metrics.push(sessionMetrics);
                }
            }
        }
        return metrics.sort((a, b) => b.date.localeCompare(a.date));
    }
    catch {
        return [];
    }
}
export async function trackPatternReuse(patternId) {
    const devDir = path.join(homedir(), 'Dev');
    const projects = [];
    const usageDates = [];
    try {
        const projectDirs = await fs.readdir(devDir, { withFileTypes: true });
        for (const projectDir of projectDirs) {
            if (!projectDir.isDirectory() || projectDir.name.startsWith('.')) {
                continue;
            }
            const artifactsPath = path.join(devDir, projectDir.name, '.agent-artifacts');
            try {
                const artifacts = await fs.readdir(artifactsPath);
                for (const artifact of artifacts) {
                    if (artifact.endsWith('.md')) {
                        const artifactPath = path.join(artifactsPath, artifact);
                        const content = await fs.readFile(artifactPath, 'utf-8');
                        if (content.includes(patternId)) {
                            projects.push(projectDir.name);
                            const date = extractDate(artifact);
                            if (date) {
                                usageDates.push(date);
                            }
                            break;
                        }
                    }
                }
            }
            catch {
                continue;
            }
        }
        if (projects.length === 0) {
            return null;
        }
        usageDates.sort();
        const [category] = patternId.split('/');
        return {
            patternId,
            category: category || 'unknown',
            reuseCount: projects.length,
            projects: Array.from(new Set(projects)),
            firstUsed: usageDates[0] || 'unknown',
            lastUsed: usageDates[usageDates.length - 1] || 'unknown',
        };
    }
    catch {
        return null;
    }
}
export async function getAllPatternReuseMetrics() {
    const patternsDir = path.join(homedir(), '.shared-patterns');
    const metrics = [];
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
        return metrics.sort((a, b) => b.reuseCount - a.reuseCount);
    }
    catch {
        return [];
    }
}
export async function calculateAggregateCompression(projectPath) {
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
    const avgCompressionRatio = metrics.reduce((sum, m) => sum + m.compressionRatio, 0) / metrics.length;
    const totalTokensSaved = metrics.reduce((sum, m) => sum + m.savings, 0);
    const sorted = [...metrics].sort((a, b) => b.compressionRatio - a.compressionRatio);
    return {
        totalSessions: metrics.length,
        avgCompressionRatio,
        totalTokensSaved,
        bestCompression: sorted[0] || null,
        worstCompression: sorted[sorted.length - 1] || null,
    };
}
function extractDate(filename) {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
    return match && match[1] ? match[1] : null;
}
//# sourceMappingURL=metrics.js.map