/**
 * Migration 002: Usage Aggregation Tables
 *
 * Creates daily and weekly usage summary tables for efficient querying
 * of aggregated usage statistics without scanning the full usage_logs table.
 */

export const migration_002 = `
-- Daily usage summary table
-- Stores aggregated usage per provider, model, and day
CREATE TABLE IF NOT EXISTS daily_usage_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  date TEXT NOT NULL,  -- ISO date: YYYY-MM-DD
  total_requests INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers(id),
  UNIQUE(provider_id, model, date)
);

-- Weekly usage summary table
-- Stores aggregated usage per provider, model, and week (ISO week)
CREATE TABLE IF NOT EXISTS weekly_usage_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,   -- ISO year
  week INTEGER NOT NULL,   -- ISO week number (1-53)
  total_requests INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers(id),
  UNIQUE(provider_id, model, year, week)
);

-- Aggregation log table to track aggregation progress and enable retries
CREATE TABLE IF NOT EXISTS aggregation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aggregation_type TEXT NOT NULL,  -- 'daily' or 'weekly'
  aggregation_date TEXT NOT NULL,   -- Date that was aggregated
  status TEXT NOT NULL,             -- 'pending', 'completed', 'failed'
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_daily_usage_provider ON daily_usage_summary(provider_id);
CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage_summary(date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_provider_date ON daily_usage_summary(provider_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_model_date ON daily_usage_summary(model, date);

CREATE INDEX IF NOT EXISTS idx_weekly_usage_provider ON weekly_usage_summary(provider_id);
CREATE INDEX IF NOT EXISTS idx_weekly_usage_year_week ON weekly_usage_summary(year, week);
CREATE INDEX IF NOT EXISTS idx_weekly_usage_provider_week ON weekly_usage_summary(provider_id, year, week);
CREATE INDEX IF NOT EXISTS idx_weekly_usage_model_week ON weekly_usage_summary(model, year, week);

CREATE INDEX IF NOT EXISTS idx_aggregation_log_type_date ON aggregation_log(aggregation_type, aggregation_date);
CREATE INDEX IF NOT EXISTS idx_aggregation_log_status ON aggregation_log(status);
`;
