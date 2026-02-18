/**
 * Sync Configuration Handler
 * Handles syncing configuration across multiple AI tools using @unify-ai/core
 */

import { importer, exporter } from '@unify-ai/core';
import type { UnifiedConfig, ToolId } from '@unify-ai/core';

export interface SyncResult {
  success: boolean;
  message: string;
  syncedTools: string[];
  errors?: string[];
  warnings?: string[];
}

export interface PreviewResult {
  success: boolean;
  toolId: string;
  files: PreviewFile[];
  errors?: string[];
  warnings?: string[];
}

export interface PreviewFile {
  path: string;
  content: string;
  size: number;
}

export interface ToolConfigResult {
  success: boolean;
  config?: UnifiedConfig;
  sourceTools?: string[];
  sourceFiles?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface ExportResult {
  success: boolean;
  message: string;
  exportedTools: string[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Import configuration from a project folder
 */
export async function importConfig(
  folderPath: string,
  options?: { mergeMultiple?: boolean; sourceTool?: string }
): Promise<ToolConfigResult> {
  try {
    const result = await importer.import(folderPath, {
      mergeMultiple: options?.mergeMultiple,
      sourceTool: options?.sourceTool as ToolId,
    });

    return {
      success: result.success,
      config: result.config,
      sourceTools: result.metadata?.sourceTools,
      sourceFiles: result.metadata?.sourceFiles,
      errors: result.errors?.map(e => e.message),
      warnings: result.warnings?.map(w => w.message),
    };
  } catch (error) {
    console.error('Error importing config:', error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Export configuration to target tools
 */
export async function exportConfig(
  config: UnifiedConfig,
  folderPath: string,
  targetTools: string[],
  options?: { createBackup?: boolean; overwrite?: boolean }
): Promise<ExportResult> {
  try {
    const exportResults = await exporter.exportMultiple(
      config,
      folderPath,
      targetTools as ToolId[],
      {
        createBackup: options?.createBackup ?? true,
        overwrite: options?.overwrite ?? true,
      }
    );

    const exportedTools: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    exportResults.forEach((result, toolId) => {
      if (result.success) {
        exportedTools.push(toolId);
      } else {
        errors.push(
          `${toolId}: ${result.errors?.map(e => e.message).join(', ') || 'Unknown error'}`
        );
      }
      if (result.warnings) {
        warnings.push(...result.warnings.map(w => `${toolId}: ${w.message}`));
      }
    });

    return {
      success: exportedTools.length > 0,
      message:
        exportedTools.length > 0
          ? `Successfully exported configuration to ${exportedTools.length} tool(s)`
          : 'Failed to export to any tools',
      exportedTools,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('Error exporting config:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      exportedTools: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Preview export result without writing files
 */
export async function previewExport(
  config: UnifiedConfig,
  targetTools: string[]
): Promise<PreviewResult[]> {
  try {
    const previewResults = await Promise.all(
      targetTools.map(async toolId => {
        try {
          const generateResult = await exporter.preview(config, toolId as ToolId);

          return {
            success: generateResult.success,
            toolId,
            files: generateResult.files.map(file => ({
              path: file.path,
              content:
                typeof file.content === 'string' ? file.content : file.content.toString('utf-8'),
              size: typeof file.content === 'string' ? file.content.length : file.content.length,
            })),
            errors: generateResult.errors?.map(e => e.message),
            warnings: generateResult.warnings?.map(w => w.message),
          };
        } catch (error) {
          return {
            success: false,
            toolId,
            files: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      })
    );

    return previewResults;
  } catch (error) {
    console.error('Error previewing export:', error);
    return targetTools.map(toolId => ({
      success: false,
      toolId,
      files: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }));
  }
}

/**
 * Sync configuration to target tools
 */
export async function syncConfig(
  sourceFolder: string,
  targetTools: string[],
  options?: { createBackup?: boolean; overwrite?: boolean }
): Promise<SyncResult> {
  try {
    // First, import the configuration
    const importResult = await importer.import(sourceFolder);

    if (!importResult.success || !importResult.config) {
      return {
        success: false,
        message: 'Failed to import configuration from source',
        syncedTools: [],
        errors: importResult.errors?.map(e => e.message) || ['Unknown import error'],
      };
    }

    // Export to all target tools
    const exportResults = await exporter.exportMultiple(
      importResult.config,
      sourceFolder,
      targetTools as ToolId[],
      {
        createBackup: options?.createBackup ?? true,
        overwrite: options?.overwrite ?? true,
      }
    );

    const syncedTools: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    exportResults.forEach((result, toolId) => {
      if (result.success) {
        syncedTools.push(toolId);
      } else {
        errors.push(
          `${toolId}: ${result.errors?.map(e => e.message).join(', ') || 'Unknown error'}`
        );
      }
      if (result.warnings) {
        warnings.push(...result.warnings.map(w => `${toolId}: ${w.message}`));
      }
    });

    return {
      success: syncedTools.length > 0,
      message:
        syncedTools.length > 0
          ? `Successfully synced configuration to ${syncedTools.length} tool(s)`
          : 'Failed to sync to any tools',
      syncedTools,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('Error syncing config:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      syncedTools: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Preview sync result without writing files
 */
export async function previewSync(
  sourceFolder: string,
  targetTools: string[]
): Promise<PreviewResult[]> {
  try {
    // Import the configuration
    const importResult = await importer.import(sourceFolder);

    if (!importResult.success || !importResult.config) {
      return targetTools.map(toolId => ({
        success: false,
        toolId,
        files: [],
        errors: ['Failed to import configuration from source'],
      }));
    }

    // Generate preview for each target tool
    const previewResults = await Promise.all(
      targetTools.map(async toolId => {
        try {
          const generateResult = await exporter.preview(importResult.config!, toolId as ToolId);

          return {
            success: generateResult.success,
            toolId,
            files: generateResult.files.map(file => ({
              path: file.path,
              content:
                typeof file.content === 'string' ? file.content : file.content.toString('utf-8'),
              size: typeof file.content === 'string' ? file.content.length : file.content.length,
            })),
            errors: generateResult.errors?.map(e => e.message),
            warnings: generateResult.warnings?.map(w => w.message),
          };
        } catch (error) {
          return {
            success: false,
            toolId,
            files: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
        }
      })
    );

    return previewResults;
  } catch (error) {
    console.error('Error previewing sync:', error);
    return targetTools.map(toolId => ({
      success: false,
      toolId,
      files: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }));
  }
}

/**
 * Get unified configuration for a specific tool
 */
export async function getToolConfig(folderPath: string, toolId: string): Promise<ToolConfigResult> {
  try {
    const result = await importer.importFrom(folderPath, toolId as ToolId);

    return {
      success: result.success,
      config: result.config,
      sourceTools: result.metadata?.sourceTools,
      sourceFiles: result.metadata?.sourceFiles,
      errors: result.errors?.map(e => e.message),
      warnings: result.warnings?.map(w => w.message),
    };
  } catch (error) {
    console.error('Error getting tool config:', error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
