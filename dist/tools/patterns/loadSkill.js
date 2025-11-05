import * as fs from 'fs/promises';
import * as path from 'path';
import { getSharedPatternsPath } from '../../utils/filesystem.js';
import { estimateTokens } from '../../utils/tokenEstimator.js';
export const loadSkillTool = {
    name: 'loadSkill',
    description: 'Load a specific skill by ID. Returns full documentation and optionally executable code.',
    inputSchema: {
        type: 'object',
        properties: {
            skillId: {
                type: 'string',
                description: 'Skill ID in format "category/skill-name" (e.g., "mcp-integration/rls-policy-generator")',
            },
            includeCode: {
                type: 'boolean',
                description: 'Include executable TypeScript code',
                default: false,
            },
            includeMetadata: {
                type: 'boolean',
                description: 'Include SKILL.md metadata',
                default: true,
            },
        },
        required: ['skillId'],
    },
};
export async function loadSkillHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        if (!input.skillId) {
            throw new Error('skillId is required');
        }
        const result = await loadSkill(input);
        const responseText = JSON.stringify(result, null, 2);
        return {
            content: [
                {
                    type: 'text',
                    text: responseText,
                },
            ],
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorResult = {
            success: false,
            error: {
                code: 'LOAD_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                duration,
            },
        };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(errorResult, null, 2),
                },
            ],
        };
    }
}
async function loadSkill(input) {
    const startTime = Date.now();
    try {
        const parts = input.skillId.split('/');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error('Invalid skillId format. Expected "category/skill-name"');
        }
        const category = parts[0];
        const skillName = parts[1];
        const categoryPath = path.join(getSharedPatternsPath(), category);
        const docPath = path.join(categoryPath, `${skillName}.md`);
        let documentation;
        try {
            documentation = await fs.readFile(docPath, 'utf-8');
        }
        catch (error) {
            throw new Error(`Skill not found: ${input.skillId}`);
        }
        let metadata;
        if (input.includeMetadata !== false) {
            const metadataPath = path.join(categoryPath, `${skillName}-SKILL.md`);
            try {
                metadata = await fs.readFile(metadataPath, 'utf-8');
            }
            catch {
                metadata = undefined;
            }
        }
        let code;
        let hasExecutable = false;
        const codePath = path.join(categoryPath, `${skillName}.ts`);
        try {
            await fs.access(codePath);
            hasExecutable = true;
            if (input.includeCode === true) {
                code = await fs.readFile(codePath, 'utf-8');
            }
        }
        catch {
            hasExecutable = false;
        }
        let totalContent = documentation;
        if (metadata)
            totalContent += metadata;
        if (code)
            totalContent += code;
        const tokensUsed = estimateTokens(totalContent);
        const duration = Date.now() - startTime;
        const skillData = {
            id: input.skillId,
            name: skillName,
            category,
            documentation,
            metadata,
            code,
            hasExecutable,
        };
        return {
            success: true,
            data: skillData,
            metadata: {
                tokensUsed,
                duration,
            },
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: {
                code: 'LOAD_ERROR',
                message: errorMessage,
            },
            metadata: {
                tokensUsed: 0,
                duration,
            },
        };
    }
}
//# sourceMappingURL=loadSkill.js.map