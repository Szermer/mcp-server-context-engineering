/**
 * executeSkill Tool
 *
 * Executes a skill with provided parameters. Implements the final stage
 * of progressive disclosure - actual code execution with minimal context.
 *
 * Token usage: ~50-200 tokens (function call + params + result)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import { getSharedPatternsPath } from '../../utils/filesystem.js';
import { estimateTokensFromJSON } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const executeSkillTool: Tool = {
  name: 'executeSkill',
  description:
    'Execute a skill with provided parameters. Returns skill-specific output.',
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

interface ExecuteSkillInput {
  skillId: string;
  input: Record<string, unknown>;
  dryRun?: boolean;
}

interface ExecuteSkillOutput {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    skillId: string;
    duration: number;
    tokensUsed: number;
  };
}

/**
 * Handler for executeSkill tool
 */
export async function executeSkillHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    // Validate and parse input
    const input = args as ExecuteSkillInput;

    if (!input.skillId) {
      throw new Error('skillId is required');
    }

    if (!input.input) {
      throw new Error('input is required');
    }

    const result = await executeSkill(input);

    // Format response for MCP
    const responseText = JSON.stringify(result, null, 2);

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorResult: ExecuteSkillOutput = {
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
      },
      metadata: {
        skillId: (args as ExecuteSkillInput).skillId || 'unknown',
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

/**
 * Core execution logic
 */
async function executeSkill(input: ExecuteSkillInput): Promise<ExecuteSkillOutput> {
  const startTime = Date.now();

  try {
    // Parse skill ID
    const parts = input.skillId.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid skillId format. Expected "category/skill-name"');
    }

    const category = parts[0];
    const skillName = parts[1];
    const categoryPath = path.join(getSharedPatternsPath(), category);
    const skillPath = path.join(categoryPath, `${skillName}.js`);

    // Dynamic import of the skill module
    // Note: The .ts file must be compiled to .js first
    let skillModule;
    try {
      const modulePath = `file://${skillPath}`;
      skillModule = await import(modulePath);
    } catch (error) {
      throw new Error(
        `Skill not found or not compiled: ${input.skillId}. ` +
        `Make sure the TypeScript file has been compiled to JavaScript.`
      );
    }

    // Find the main exported function
    // Convention: Use the camelCase version of the skill name
    const functionName = skillName
      .split('-')
      .map((part, index) => {
        if (index === 0) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join('');

    const skillFunction = skillModule[functionName];

    if (typeof skillFunction !== 'function') {
      throw new Error(
        `Skill ${input.skillId} does not export a function named "${functionName}"`
      );
    }

    // Dry run: validate input only
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

    // Execute the skill
    const result = await skillFunction(input.input);

    // Calculate token usage
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
  } catch (error) {
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
