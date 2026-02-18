export const migration_001 = `
-- providers table
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  config TEXT,
  models TEXT,
  default_model TEXT,
  base_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- api_keys table
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  key_name TEXT,
  encrypted_key BLOB NOT NULL,
  iv BLOB,
  auth_tag BLOB,
  is_valid INTEGER DEFAULT 0,
  last_validated TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  UNIQUE(provider_id, key_name)
);

-- usage_logs table
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
  metadata TEXT,
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- model_configs table
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
  FOREIGN KEY (provider_id) REFERENCES providers(id),
  UNIQUE(provider_id, model_id)
);

-- indexes
CREATE INDEX idx_usage_logs_provider ON usage_logs(provider_id);
CREATE INDEX idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX idx_usage_logs_model ON usage_logs(provider_id, model);
`;
