/**
 * Base adapter exports
 */

export { BaseAdapter } from './BaseAdapter';
export type {
  IAdapter,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  IRuleParser,
  RuleParseResult,
  IMCPParser,
  MCPParseResult,
  ISettingsParser,
  SettingsParseResult,
  ParseContext,
} from './IAdapter';
export {
  declareCapability,
  Capabilities,
  ToolCapabilities,
  isCapabilityAvailable,
  canExportCapability,
  canImportCapability,
  getCompatibilityNotes,
} from './Capability';
