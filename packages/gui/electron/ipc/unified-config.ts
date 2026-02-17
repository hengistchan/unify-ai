/**
 * Unified Config Persistence Handler
 * Handles saving and loading unified.json
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const UNIFIED_CONFIG_FILE = 'unified.json';

export interface SaveResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  config?: unknown;
  path?: string;
  error?: string;
}

/**
 * Save unified config to project root
 */
export async function saveUnifiedConfig(
  projectRoot: string,
  config: unknown
): Promise<SaveResult> {
  const configPath = path.join(projectRoot, UNIFIED_CONFIG_FILE);

  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[UnifiedConfig] Saved to:', configPath);
    return {
      success: true,
      path: configPath,
    };
  } catch (error) {
    console.error('[UnifiedConfig] Failed to save:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load unified config from project root
 */
export async function loadUnifiedConfig(
  projectRoot: string
): Promise<LoadResult> {
  const configPath = path.join(projectRoot, UNIFIED_CONFIG_FILE);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    console.log('[UnifiedConfig] Loaded from:', configPath);
    return {
      success: true,
      config,
      path: configPath,
    };
  } catch (error) {
    // File doesn't exist is not an error
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('[UnifiedConfig] No saved config found at:', configPath);
      return {
        success: false,
        error: 'No saved configuration found',
      };
    }
    console.error('[UnifiedConfig] Failed to load:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
