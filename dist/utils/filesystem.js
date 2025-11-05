import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
export function getSharedPatternsPath() {
    return path.join(homedir(), '.shared-patterns');
}
export async function getPatternCategories() {
    const patternsDir = getSharedPatternsPath();
    try {
        const entries = await fs.readdir(patternsDir, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .filter((name) => !name.startsWith('.'));
    }
    catch (error) {
        return [];
    }
}
export async function searchPatternsInCategory(category, keyword, includeExecutable) {
    const categoryPath = path.join(getSharedPatternsPath(), category);
    try {
        const entries = await fs.readdir(categoryPath, { withFileTypes: true });
        const patterns = [];
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('-SKILL.md')) {
                const baseName = entry.name.replace('.md', '');
                const fullPath = path.join(categoryPath, entry.name);
                const tsPath = path.join(categoryPath, `${baseName}.ts`);
                const hasExecutable = await fileExists(tsPath);
                if (includeExecutable === true && !hasExecutable) {
                    continue;
                }
                const skillPath = path.join(categoryPath, `${baseName}-SKILL.md`);
                let quality;
                let description = '';
                if (await fileExists(skillPath)) {
                    const skillContent = await fs.readFile(skillPath, 'utf-8');
                    quality = extractQualityScore(skillContent);
                    description = extractDescription(skillContent);
                }
                else {
                    const mdContent = await fs.readFile(fullPath, 'utf-8');
                    description = extractFirstParagraph(mdContent);
                }
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
    }
    catch (error) {
        return [];
    }
}
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function extractQualityScore(content) {
    const match = content.match(/\*\*Overall Score:\*\*\s*(\d+(?:\.\d+)?)/i);
    if (match && match[1]) {
        return parseFloat(match[1]);
    }
    return undefined;
}
function extractDescription(content) {
    const overviewMatch = content.match(/##\s*Overview\s*\n\n(.*?)(?=\n##|\n\n##|$)/s);
    if (overviewMatch && overviewMatch[1]) {
        return overviewMatch[1].trim().slice(0, 200);
    }
    return extractFirstParagraph(content);
}
function extractFirstParagraph(content) {
    const lines = content.split('\n');
    let foundTitle = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!foundTitle) {
            if (trimmed.startsWith('#')) {
                foundTitle = true;
            }
            continue;
        }
        if (trimmed === '' || trimmed.startsWith('**') || trimmed.startsWith('*')) {
            continue;
        }
        if (trimmed.length > 0) {
            return trimmed.slice(0, 200);
        }
    }
    return 'No description available';
}
//# sourceMappingURL=filesystem.js.map