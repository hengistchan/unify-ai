/**
 * Core - Validator
 * Configuration validation utilities
 */

import type { UnifiedConfig } from './types';

// ============================================
// Type definitions
// ============================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error path */
  path: string;
  /** Error message */
  message: string;
  /** Error value */
  value?: unknown;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning path */
  path: string;
  /** Warning message */
  message: string;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================
// Validator class
// ============================================

/**
 * Configuration validator
 */
export class ConfigValidator {
  /**
   * Validate unified configuration
   * @param config Configuration to validate
   * @returns Validation result
   */
  validate(config: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if config is an object
    if (!config || typeof config !== 'object') {
      errors.push({
        path: '',
        message: 'Configuration must be an object',
      });
      return { valid: false, errors, warnings };
    }

    const cfg = config as Record<string, unknown>;

    // Validate version
    if (!cfg.version || typeof cfg.version !== 'string') {
      errors.push({
        path: 'version',
        message: 'Version is required and must be a string',
      });
    }

    // Validate rules
    if (cfg.rules !== undefined) {
      if (!Array.isArray(cfg.rules)) {
        errors.push({
          path: 'rules',
          message: 'Rules must be an array',
        });
      } else {
        this.validateRules(cfg.rules, errors, warnings);
      }
    }

    // Validate MCP configuration
    if (cfg.mcp !== undefined) {
      this.validateMcp(cfg.mcp, errors, warnings);
    }

    // Validate settings
    if (cfg.settings !== undefined) {
      this.validateSettings(cfg.settings, errors, warnings);
    }

    // Validate commands
    if (cfg.commands !== undefined) {
      if (!Array.isArray(cfg.commands)) {
        errors.push({
          path: 'commands',
          message: 'Commands must be an array',
        });
      } else {
        this.validateCommands(cfg.commands, errors, warnings);
      }
    }

    // Validate prompts
    if (cfg.prompts !== undefined) {
      if (!Array.isArray(cfg.prompts)) {
        errors.push({
          path: 'prompts',
          message: 'Prompts must be an array',
        });
      } else {
        this.validatePrompts(cfg.prompts, errors, warnings);
      }
    }

    // Validate contextFiles
    if (cfg.contextFiles !== undefined) {
      if (!Array.isArray(cfg.contextFiles)) {
        errors.push({
          path: 'contextFiles',
          message: 'Context files must be an array',
        });
      } else if (!cfg.contextFiles.every(f => typeof f === 'string')) {
        errors.push({
          path: 'contextFiles',
          message: 'All context files must be strings',
        });
      }
    }

    // Validate ignorePatterns
    if (cfg.ignorePatterns !== undefined) {
      if (!Array.isArray(cfg.ignorePatterns)) {
        errors.push({
          path: 'ignorePatterns',
          message: 'Ignore patterns must be an array',
        });
      } else if (!cfg.ignorePatterns.every(p => typeof p === 'string')) {
        errors.push({
          path: 'ignorePatterns',
          message: 'All ignore patterns must be strings',
        });
      }
    }

    // Validate envVars
    if (cfg.envVars !== undefined) {
      if (typeof cfg.envVars !== 'object' || cfg.envVars === null || Array.isArray(cfg.envVars)) {
        errors.push({
          path: 'envVars',
          message: 'Environment variables must be an object',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate rules
   */
  private validateRules(
    rules: unknown[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const path = `rules[${i}]`;

      if (!rule || typeof rule !== 'object') {
        errors.push({
          path,
          message: 'Rule must be an object',
        });
        continue;
      }

      const r = rule as Record<string, unknown>;

      // Validate required fields
      if (!r.id || typeof r.id !== 'string') {
        errors.push({
          path: `${path}.id`,
          message: 'Rule ID is required and must be a string',
        });
      }

      if (!r.content || typeof r.content !== 'string') {
        errors.push({
          path: `${path}.content`,
          message: 'Rule content is required and must be a string',
        });
      }

      // Validate optional fields
      if (r.globs !== undefined) {
        if (!Array.isArray(r.globs)) {
          errors.push({
            path: `${path}.globs`,
            message: 'Globs must be an array',
          });
        }
      }

      if (r.priority !== undefined && typeof r.priority !== 'number') {
        errors.push({
          path: `${path}.priority`,
          message: 'Priority must be a number',
        });
      }
    }
  }

  /**
   * Validate MCP configuration
   */
  private validateMcp(
    mcp: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!mcp || typeof mcp !== 'object') {
      errors.push({
        path: 'mcp',
        message: 'MCP configuration must be an object',
      });
      return;
    }

    const m = mcp as Record<string, unknown>;

    if (!m.servers || !Array.isArray(m.servers)) {
      warnings.push({
        path: 'mcp.servers',
        message: 'MCP servers should be an array',
        suggestion: 'Add an empty array if no MCP servers are configured',
      });
      return;
    }

    for (let i = 0; i < m.servers.length; i++) {
      const server = m.servers[i];
      const path = `mcp.servers[${i}]`;

      if (!server || typeof server !== 'object') {
        errors.push({
          path,
          message: 'Server must be an object',
        });
        continue;
      }

      const s = server as Record<string, unknown>;

      // Validate required fields
      if (!s.name || typeof s.name !== 'string') {
        errors.push({
          path: `${path}.name`,
          message: 'Server name is required and must be a string',
        });
      }

      if (!s.command || typeof s.command !== 'string') {
        errors.push({
          path: `${path}.command`,
          message: 'Server command is required and must be a string',
        });
      }

      // Validate optional fields
      if (s.args !== undefined && !Array.isArray(s.args)) {
        errors.push({
          path: `${path}.args`,
          message: 'Args must be an array',
        });
      }

      if (s.env !== undefined && (typeof s.env !== 'object' || s.env === null)) {
        errors.push({
          path: `${path}.env`,
          message: 'Env must be an object',
        });
      }
    }
  }

  /**
   * Validate settings
   */
  private validateSettings(
    settings: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!settings || typeof settings !== 'object') {
      errors.push({
        path: 'settings',
        message: 'Settings must be an object',
      });
      return;
    }

    const s = settings as Record<string, unknown>;

    // Validate model
    if (s.model !== undefined) {
      if (typeof s.model !== 'object' || s.model === null) {
        errors.push({
          path: 'settings.model',
          message: 'Model must be an object',
        });
      }
    }

    // Validate permissions
    if (s.permissions !== undefined) {
      if (typeof s.permissions !== 'object' || s.permissions === null) {
        errors.push({
          path: 'settings.permissions',
          message: 'Permissions must be an object',
        });
      } else {
        const perms = s.permissions as Record<string, unknown>;
        if (perms.allow !== undefined && !Array.isArray(perms.allow)) {
          errors.push({
            path: 'settings.permissions.allow',
            message: 'Allow must be an array',
          });
        }
        if (perms.deny !== undefined && !Array.isArray(perms.deny)) {
          errors.push({
            path: 'settings.permissions.deny',
            message: 'Deny must be an array',
          });
        }
      }
    }

    // Validate behavior
    if (s.behavior !== undefined) {
      if (typeof s.behavior !== 'object' || s.behavior === null) {
        errors.push({
          path: 'settings.behavior',
          message: 'Behavior must be an object',
        });
      }
    }
  }

  /**
   * Validate commands
   */
  private validateCommands(
    commands: unknown[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const path = `commands[${i}]`;

      if (!cmd || typeof cmd !== 'object') {
        errors.push({
          path,
          message: 'Command must be an object',
        });
        continue;
      }

      const c = cmd as Record<string, unknown>;

      // Validate required fields
      if (!c.id || typeof c.id !== 'string') {
        errors.push({
          path: `${path}.id`,
          message: 'Command ID is required and must be a string',
        });
      }

      if (!c.name || typeof c.name !== 'string') {
        errors.push({
          path: `${path}.name`,
          message: 'Command name is required and must be a string',
        });
      }

      if (!c.template || typeof c.template !== 'string') {
        errors.push({
          path: `${path}.template`,
          message: 'Command template is required and must be a string',
        });
      }

      // Validate arguments
      if (c.arguments !== undefined) {
        if (!Array.isArray(c.arguments)) {
          errors.push({
            path: `${path}.arguments`,
            message: 'Arguments must be an array',
          });
        }
      }
    }
  }

  /**
   * Validate prompts
   */
  private validatePrompts(
    prompts: unknown[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const path = `prompts[${i}]`;

      if (!prompt || typeof prompt !== 'object') {
        errors.push({
          path,
          message: 'Prompt must be an object',
        });
        continue;
      }

      const p = prompt as Record<string, unknown>;

      // Validate required fields
      if (!p.id || typeof p.id !== 'string') {
        errors.push({
          path: `${path}.id`,
          message: 'Prompt ID is required and must be a string',
        });
      }

      if (!p.name || typeof p.name !== 'string') {
        errors.push({
          path: `${path}.name`,
          message: 'Prompt name is required and must be a string',
        });
      }

      if (!p.template || typeof p.template !== 'string') {
        errors.push({
          path: `${path}.template`,
          message: 'Prompt template is required and must be a string',
        });
      }

      // Validate variables
      if (p.variables !== undefined) {
        if (!Array.isArray(p.variables)) {
          errors.push({
            path: `${path}.variables`,
            message: 'Variables must be an array',
          });
        }
      }
    }
  }
}

// ============================================
// Export singleton
// ============================================

/**
 * Default validator instance
 */
export const configValidator: ConfigValidator = new ConfigValidator();
