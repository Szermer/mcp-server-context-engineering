import * as path from 'path';
import { getSharedPatternsPath } from '../../utils/filesystem.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';
export const executeSkillTool = {
    name: 'executeSkill',
    description: 'Execute a skill with provided parameters. Returns skill-specific output.',
    inputSchema: {
        type: 'object',
        properties: {
            skillId: {
                type: 'string',
                description: 'Skill ID in format "category/skill-name"',
            },
            input: {
                type: 'object',
                description: 'Skill-specific input parameters',
            },
            dryRun: {
                type: 'boolean',
                description: 'Validate input without executing (default: false)',
                default: false,
            },
        },
        required: ['skillId', 'input'],
    },
};
export async function executeSkillHandler(args) {
    const startTime = Date.now();
    try {
        const input = args;
        if (!input.skillId) {
            throw new Error('skillId is required');
        }
        if (!input.input) {
            throw new Error('input is required');
        }
        const result = await executeSkill(input);
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
                code: 'EXECUTION_ERROR',
                message: errorMessage,
            },
            metadata: {
                skillId: args.skillId || 'unknown',
                duration,
                tokensUsed: 0,
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
async function executeSkill(input) {
    const startTime = Date.now();
    try {
        const parts = input.skillId.split('/');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error('Invalid skillId format. Expected "category/skill-name"');
        }
        const category = parts[0];
        const skillName = parts[1];
        const categoryPath = path.join(getSharedPatternsPath(), category);
        const skillPath = path.join(categoryPath, `${skillName}.js`);
        let skillModule;
        try {
            const modulePath = `file://${skillPath}`;
            skillModule = await import(modulePath);
        }
        catch (error) {
            throw new Error(`Skill not found or not compiled: ${input.skillId}. ` +
                `Make sure the TypeScript file has been compiled to JavaScript.`);
        }
        const functionName = skillName
            .split('-')
            .map((part, index) => {
            if (index === 0)
                return part;
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
            .join('');
        const skillFunction = skillModule[functionName];
        if (typeof skillFunction !== 'function') {
            throw new Error(`Skill ${input.skillId} does not export a function named "${functionName}"`);
        }
        if (input.dryRun === true) {
            const duration = Date.now() - startTime;
            return {
                success: true,
                data: {
                    message: 'Dry run successful - input is valid',
                    functionName,
                    input: input.input,
                },
                metadata: {
                    skillId: input.skillId,
                    duration,
                    tokensUsed: estimateTokensFromJSON(input.input),
                },
            };
        }
        const result = await skillFunction(input.input);
        const tokensUsed = estimateTokensFromJSON({
            input: input.input,
            output: result,
        });
        const duration = Date.now() - startTime;
        return {
            success: true,
            data: result,
            metadata: {
                skillId: input.skillId,
                duration,
                tokensUsed,
            },
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: {
                code: 'EXECUTION_ERROR',
                message: errorMessage,
            },
            metadata: {
                skillId: input.skillId,
                duration,
                tokensUsed: 0,
            },
        };
    }
}
//# sourceMappingURL=executeSkill.js.map