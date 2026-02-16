/**
 * Converter module exports
 */

export {
  DiffEngine,
  diffEngine,
  type DiffEntry,
  type DiffResult,
  type DiffSummary,
  type ComputeDiffOptions,
  DiffType,
} from './DiffEngine';

export {
  Importer,
  importer,
  type ImportOptions,
  type ImportResult,
  type ImportError,
  type ImportWarning,
} from './Importer';

export {
  Exporter,
  exporter,
  type ExportOptions,
  type ExportResult,
  type ExportedFile,
  type ExportError,
  type ExportWarning,
} from './Exporter';

export {
  ConflictResolver,
  createConflictResolver,
  type ConflictStrategy,
  type Conflict,
  type ConflictResolution,
  ConflictType,
} from './ConflictResolver';

export {
  ChangeTracker,
  getChangeTracker,
  createChangeTracker,
  type ChangeSource,
  type ChangeSourceType,
  type ChangeEvent,
  type ChangeRecord,
  type PropertyChange,
  type HistoryOptions,
} from './ChangeTracker';

export {
  FingerprintManager,
  getFingerprintManager,
  createFingerprintManager,
  type FileFingerprint,
  type FingerprintVerification,
} from './FingerprintManager';
