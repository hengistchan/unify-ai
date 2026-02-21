/**
 * Migration 003: Hybrid Tool Isolation
 *
 * This migration transforms the providers table to support hybrid tool isolation:
 * - Global providers (tool_id = 'global') shared across all tools
 * - Tool-specific providers (tool_id = 'tool-name') for per-tool overrides
 *
 * Key changes:
 * - Composite primary key: (id, tool_id) with tool_id DEFAULT 'global'
 * - New fields: tool_id, is_global, is_current_global, is_current_tool, sort_index, category, notes, meta
 * - All existing providers become global providers (is_global = 1)
 * - Removed FK constraints from usage tables for better flexibility (Option 2)
 *
 * Design decision (Option 2):
 * - Removed FK constraints from usage_logs, daily_usage_summary, weekly_usage_summary, model_configs
 * - FK constraint kept only for api_keys (uses composite key matching providers PK)
 * - Logical integrity maintained in application layer (ModelManager)
 * - Rationale: Usage data is append-only, rarely deleted, and app layer validates
 */

export const migration_003 = `
-- Migration 003: Hybrid Tool Isolation
-- Uses Option 2: Remove FK constraints from usage tables, keep logical integrity
-- All existing providers become global providers (tool_id = 'global')

-- Step 1: Drop tables with foreign key references to providers first
-- We'll recreate them after modifying providers table
DROP TABLE IF EXISTS model_configs;
DROP TABLE IF EXISTS usage_logs;
DROP TABLE IF EXISTS daily_usage_summary;
DROP TABLE IF EXISTS weekly_usage_summary;
DROP TABLE IF EXISTS api_keys;

-- Step 2: Drop old providers table and create new one with hybrid tool isolation
DROP TABLE IF EXISTS providers;

CREATE TABLE providers (
  id TEXT NOT NULL,
  tool_id TEXT NOT NULL DEFAULT 'global',
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  config TEXT,
  models TEXT,
  default_model TEXT,
  base_url TEXT,
  is_global INTEGER DEFAULT 0,
  is_current_global INTEGER DEFAULT 0,
  is_current_tool INTEGER DEFAULT 0,
  sort_index INTEGER DEFAULT 0,
  category TEXT DEFAULT 'third-party',
  notes TEXT,
  meta TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, tool_id)
);

-- Step 3: Recreate api_keys table with tool_id support
-- Note: Uses composite foreign key that matches providers primary key
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  provider_tool_id TEXT NOT NULL DEFAULT 'global',
  key_name TEXT DEFAULT 'primary',
  encrypted_key BLOB NOT NULL,
  iv BLOB,
  auth_tag BLOB,
  is_valid INTEGER DEFAULT 0,
  last_validated TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id, provider_tool_id)
    REFERENCES providers(id, tool_id) ON DELETE CASCADE,
  UNIQUE(provider_id, provider_tool_id, key_name)
);

-- Step 4: Recreate model_configs table (no FK since providers uses composite PK)
-- Note: Logical integrity maintained in application layer
CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT,
  context_window INTEGER,
  max_output_tokens INTEGER,
  pricing_input REAL,
  pricing_output REAL,
  enabled INTEGER DEFAULT 1,
  config TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model_id)
);

-- Step 5: Recreate usage_logs table (no FK since providers uses composite PK)
-- Note: Usage logs are append-only and rarely deleted
CREATE TABLE usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  request_id TEXT,
  metadata TEXT
);

-- Step 6: Recreate daily_usage_summary table (no FK since providers uses composite PK)
CREATE TABLE daily_usage_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  date TEXT NOT NULL,
  total_requests INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model, date)
);

-- Step 7: Recreate weekly_usage_summary table (no FK since providers uses composite PK)
CREATE TABLE weekly_usage_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  total_requests INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model, year, week)
);

-- Step 8: Create indexes for hybrid tool isolation queries
CREATE INDEX idx_providers_global ON providers(is_global, is_current_global, priority DESC)
  WHERE is_global = 1;
CREATE INDEX idx_providers_tool ON providers(tool_id, is_current_tool, priority DESC)
  WHERE tool_id != 'global';
CREATE INDEX idx_providers_id ON providers(id);
CREATE INDEX idx_api_keys_provider_tool ON api_keys(provider_id, provider_tool_id);

-- Step 9: Recreate other indexes
CREATE INDEX idx_api_keys_provider ON api_keys(provider_id);
CREATE INDEX idx_usage_logs_provider ON usage_logs(provider_id);
CREATE INDEX idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX idx_model_configs_provider ON model_configs(provider_id);
CREATE INDEX idx_daily_usage_provider ON daily_usage_summary(provider_id);
CREATE INDEX idx_daily_usage_date ON daily_usage_summary(date);
CREATE INDEX idx_daily_usage_provider_date ON daily_usage_summary(provider_id, date);
CREATE INDEX idx_daily_usage_model_date ON daily_usage_summary(model, date);
CREATE INDEX idx_weekly_usage_provider ON weekly_usage_summary(provider_id);
CREATE INDEX idx_weekly_usage_year_week ON weekly_usage_summary(year, week);
CREATE INDEX idx_weekly_usage_provider_week ON weekly_usage_summary(provider_id, year, week);
CREATE INDEX idx_weekly_usage_model_week ON weekly_usage_summary(model, year, week);
`;
