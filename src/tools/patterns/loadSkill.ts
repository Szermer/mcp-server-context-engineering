/**
 * loadSkill Tool
 *
 * Loads a specific skill by ID, returning full documentation and optionally
 * the executable code. Implements second stage of progressive disclosure.
 *
 * Token usage: ~500-1000 tokens for documentation
 *              ~1000-3000 tokens if including executable code
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getSharedPatternsPath } from '../../utils/filesystem.js';
import { estimateTokens } from '../../utils/tokenEstimator.js';

/**
 * Tool definition for MCP
 */
export const loadSkillTool: Tool = {
  name: 'loadSkill',
  description:
    'Load a specific skill by ID. Returns full documentation and optionally executable code.',
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

interface LoadSkillInput {
  skillId: string;
  includeCode?: boolean;
  includeMetadata?: boolean;
}

interface SkillData {
  id: string;
  name: string;
  category: string;
  documentation: string;
  metadata?: string;
  code?: string;
  hasExecutable: boolean;
}

interface LoadSkillOutput {
  success: boolean;
  data?: SkillData;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    tokensUsed: number;
    duration: number;
  };
}

/**
 * Handler for loadSkill tool
 */
export async function loadSkillHandler(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const startTime = Date.now();

  try {
    // Validate and parse input
    const input = args as LoadSkillInput;

    if (!input.skillId) {
      throw new Error('skillId is required');
    }

    const result = await loadSkill(input);

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

    const errorResult: LoadSkillOutput = {
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

/**
 * Core load logic
 */
async function loadSkill(input: LoadSkillInput): Promise<LoadSkillOutput> {
  const startTime = Date.now();

  try {
    // Parse skill ID
    const parts = input.skillId.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        'Invalid skillId format. Expected "category/skill-name"'
      );
    }

    const category = parts[0];
    const skillName = parts[1];
    const categoryPath = path.join(getSharedPatternsPath(), category);

    // Load main documentation
    const docPath = path.join(categoryPath, `${skillName}.md`);
    let documentation: string;

    try {
      documentation = await fs.readFile(docPath, 'utf-8');
    } catch (error) {
      throw new Error(`Skill not found: ${input.skillId}`);
    }

    // Load metadata if requested
    let metadata: string | undefined;
    if (input.includeMetadata !== false) {
      const metadataPath = path.join(categoryPath, `${skillName}-SKILL.md`);
      try {
        metadata = await fs.readFile(metadataPath, 'utf-8');
      } catch {
        // Metadata is optional
        metadata = undefined;
      }
    }

    // Load code if requested
    let code: string | undefined;
    let hasExecutable = false;
    const codePath = path.join(categoryPath, `${skillName}.ts`);

    try {
      await fs.access(codePath);
      hasExecutable = true;

      if (input.includeCode === true) {
        code = await fs.readFile(codePath, 'utf-8');
      }
    } catch {
      // Code is optional
      hasExecutable = false;
    }

    // Calculate token usage
    let totalContent = documentation;
    if (metadata) totalContent += metadata;
    if (code) totalContent += code;

    const tokensUsed = estimateTokens(totalContent);
    const duration = Date.now() - startTime;

    const skillData: SkillData = {
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
  } catch (error) {
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
