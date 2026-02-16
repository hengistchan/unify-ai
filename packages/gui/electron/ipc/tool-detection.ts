/**
 * Tool Detection Handler
 * Detects AI coding assistant tools in a given directory
 */

import { dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export interface DetectedTool {
  id: string;
  name: string;
  configPath: string;
  hasRules: boolean;
  hasMcp: boolean;
  hasSettings: boolean;
}

// Tool configuration patterns
const TOOL_CONFIG_PATTERNS: Record<string, {
  name: string;
  patterns: string[];
  hasMcp: boolean;
  hasSettings: boolean;
}> = {
  cursor: {
    name: 'Cursor',
    patterns: ['.cursorrules', '.cursor'],
    hasMcp: false,
    hasSettings: true,
  },
  'claude-code': {
    name: 'Claude Code',
    patterns: ['CLAUDE.md', '.claude'],
    hasMcp: true,
    hasSettings: true,
  },
  copilot: {
    name: 'GitHub Copilot',
    patterns: ['.github/copilot-instructions.md'],
    hasMcp: false,
    hasSettings: false,
  },
  windsurf: {
    name: 'Windsurf',
    patterns: ['.windsurfrules', '.windsurf'],
    hasMcp: true,
    hasSettings: true,
  },
  cline: {
    name: 'Cline',
    patterns: ['.clinerules', '.cline'],
    hasMcp: true,
    hasSettings: false,
  },
  aider: {
    name: 'Aider',
    patterns: ['.aider.conf.yml', 'aider.conf.yml'],
    hasMcp: false,
    hasSettings: true,
  },
  continue: {
    name: 'Continue',
    patterns: ['.continue/config.json', 'continue.json'],
    hasMcp: true,
    hasSettings: true,
  },
  codex: {
    name: 'Codex',
    patterns: ['CODEX.md', 'codex.toml'],
    hasMcp: true,
    hasSettings: true,
  },
};

/**
 * Detect AI tools in a directory
 */
export async function detectTools(folderPath: string): Promise<DetectedTool[]> {
  const detectedTools: DetectedTool[] = [];

  try {
    const files = await fs.readdir(folderPath);

    for (const [toolId, config] of Object.entries(TOOL_CONFIG_PATTERNS)) {
      for (const pattern of config.patterns) {
        const patternBase = pattern.split('/')[0];
        const hasMatch = files.some((f) => f === pattern || f === patternBase);

        if (hasMatch) {
          // Check for rules
          const hasRules = await checkRules(folderPath, toolId);

          detectedTools.push({
            id: toolId,
            name: config.name,
            configPath: pattern,
            hasRules,
            hasMcp: config.hasMcp,
            hasSettings: config.hasSettings,
          });
          break; // Only add once per tool
        }
      }
    }
  } catch (error) {
    console.error('Error detecting tools:', error);
  }

  return detectedTools;
}

/**
 * Check if tool has rules configured
 */
async function checkRules(folderPath: string, toolId: string): Promise<boolean> {
  const rulesPaths: Record<string, string[]> = {
    'claude-code': ['.claude/CLAUDE.md', 'CLAUDE.md'],
    cursor: ['.cursor/rules', '.cursorrules'],
    copilot: ['.github/copilot-instructions.md'],
    windsurf: ['.windsurfrules'],
    cline: ['.clinerules'],
    aider: ['.aider.conf.yml'],
    continue: ['.continue/rules'],
    codex: ['CODEX.md'],
  };

  const paths = rulesPaths[toolId] || [];
  for (const rulesPath of paths) {
    try {
      await fs.access(path.join(folderPath, rulesPath));
      return true;
    } catch {
      // File doesn't exist, continue checking
    }
  }

  return false;
}

/**
 * Open folder dialog
 */
export async function openFolderDialog(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Project Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}
