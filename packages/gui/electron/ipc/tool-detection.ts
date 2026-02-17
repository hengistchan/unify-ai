/**
 * Tool Detection Handler
 * Detects AI coding assistant tools in a given directory using @unify-ai/core
 */

import { dialog } from 'electron';
import { fileDiscovery } from '@unify-ai/core';
import type { IAdapter } from '@unify-ai/core';
import { ConfigCapability } from '@unify-ai/core';

export interface DetectedTool {
  id: string;
  name: string;
  configPath: string;
  detected: boolean;
  hasRules: boolean;
  hasMcp: boolean;
  hasSettings: boolean;
}

/**
 * Detect AI tools in a directory using core fileDiscovery
 */
export async function detectTools(folderPath: string): Promise<DetectedTool[]> {
  try {
    const adapters = await fileDiscovery.detectTools(folderPath);

    return adapters.map((adapter: IAdapter) => {
      const filePatterns = adapter.getFilePatterns();
      const primaryPattern = filePatterns[0]?.pattern || '';

      return {
        id: adapter.toolMeta.id,
        name: adapter.toolMeta.name,
        configPath: primaryPattern,
        detected: true,
        hasRules: adapter.hasCapability(ConfigCapability.RULES),
        hasMcp: adapter.hasCapability(ConfigCapability.MCP_SERVERS),
        hasSettings: adapter.hasCapability(ConfigCapability.SETTINGS),
      };
    });
  } catch (error) {
    console.error('Error detecting tools:', error);
    return [];
  }
}

/**
 * Get detailed discovery results including file information
 */
export async function discoverConfigFiles(folderPath: string) {
  try {
    const result = await fileDiscovery.discover(folderPath);
    return {
      files: result.files.map((file) => ({
        path: file.path,
        absolutePath: file.absolutePath,
        exists: file.exists,
        size: file.size,
        capability: file.capability,
        adapterId: file.adapter.toolMeta.id,
      })),
      detectedTools: result.detectedTools.map((adapter: IAdapter) => ({
        id: adapter.toolMeta.id,
        name: adapter.toolMeta.name,
      })),
      scanTime: result.scanTime,
    };
  } catch (error) {
    console.error('Error discovering config files:', error);
    return { files: [], detectedTools: [], scanTime: 0 };
  }
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
