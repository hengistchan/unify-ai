import Database from 'better-sqlite3';
import type { Database as DatabaseType, Statement } from 'better-sqlite3';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * ModelDatabase - SQLite database wrapper for model configuration management
 *
 * Provides a type-safe interface for managing AI providers, API keys,
 * usage logs, and model configurations with automatic schema migrations.
 *
 * Supports hybrid tool isolation:
 * - Global providers (tool_id = 'global') shared across all tools
 * - Tool-specific providers (tool_id = 'tool-name') for per-tool overrides
 */
export class ModelDatabase {
  private db: DatabaseType | null = null;
  private dbPath: string;
  private statements: Map<string, Statement> = new Map();

  /**
   * Create a new ModelDatabase instance
   * @param dbPath - Path to SQLite database file (default: ~/.unify-ai/models.db)
   */
  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.unify-ai', 'models.db');
  }

  /**
   * Initialize the database connection and run migrations
   */
  async initialize(): Promise<void> {
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    await fs.mkdir(dbDir, { recursive: true });

    // Open database connection
    this.db = new Database(this.dbPath);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    this.runMigrations();

    // Prepare commonly used statements
    this.prepareStatements();
  }

  /**
   * Run database schema migrations
   */
  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Create migrations tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Define migrations
    const migrations = [
      {
        name: '001_initial_schema',
        sql: `
          -- Providers table
          CREATE TABLE IF NOT EXISTS providers (
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

          -- API keys table
          CREATE TABLE IF NOT EXISTS api_keys (
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

          -- Usage logs table
          CREATE TABLE IF NOT EXISTS usage_logs (
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

          -- Model configurations table
          CREATE TABLE IF NOT EXISTS model_configs (
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

          -- Create indexes for better query performance
          CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider_id);
          CREATE INDEX IF NOT EXISTS idx_usage_logs_provider ON usage_logs(provider_id);
          CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp);
          CREATE INDEX IF NOT EXISTS idx_model_configs_provider ON model_configs(provider_id);
        `,
      },
      {
        name: '002_usage_aggregation',
        sql: `
          -- Daily usage summary table
          CREATE TABLE IF NOT EXISTS daily_usage_summary (
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
            FOREIGN KEY (provider_id) REFERENCES providers(id),
            UNIQUE(provider_id, model, date)
          );

          -- Weekly usage summary table
          CREATE TABLE IF NOT EXISTS weekly_usage_summary (
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
            FOREIGN KEY (provider_id) REFERENCES providers(id),
            UNIQUE(provider_id, model, year, week)
          );

          -- Aggregation log table
          CREATE TABLE IF NOT EXISTS aggregation_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aggregation_type TEXT NOT NULL,
            aggregation_date TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );

          -- Indexes
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
        `,
      },
      {
        name: '003_hybrid_tool_isolation',
        sql: `
          -- Drop tables with foreign key references to providers first
          -- We'll recreate them after modifying providers table
          DROP TABLE IF EXISTS model_configs;
          DROP TABLE IF EXISTS usage_logs;
          DROP TABLE IF EXISTS daily_usage_summary;
          DROP TABLE IF EXISTS weekly_usage_summary;
          DROP TABLE IF EXISTS api_keys;

          -- Drop old providers table and create new one with hybrid tool isolation
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

          -- Recreate api_keys table with tool_id support
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

          -- Recreate model_configs table (no FK since providers uses composite PK)
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

          -- Recreate usage_logs table (no FK since providers uses composite PK)
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

          -- Recreate daily_usage_summary table (no FK since providers uses composite PK)
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

          -- Recreate weekly_usage_summary table (no FK since providers uses composite PK)
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

          -- Create indexes for hybrid tool isolation queries
          CREATE INDEX idx_providers_global ON providers(is_global, is_current_global, priority DESC)
            WHERE is_global = 1;
          CREATE INDEX idx_providers_tool ON providers(tool_id, is_current_tool, priority DESC)
            WHERE tool_id != 'global';
          CREATE INDEX idx_providers_id ON providers(id);
          CREATE INDEX idx_api_keys_provider_tool ON api_keys(provider_id, provider_tool_id);

          -- Recreate other indexes
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
        `,
      },
      {
        name: '004_model_configs_tool_isolation',
        sql: `
          -- Drop existing model_configs table and recreate with tool isolation
          DROP TABLE IF EXISTS model_configs;

          CREATE TABLE model_configs (
            id TEXT PRIMARY KEY,
            provider_id TEXT NOT NULL,
            provider_tool_id TEXT NOT NULL DEFAULT 'global',
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
            UNIQUE(provider_id, provider_tool_id, model_id)
          );

          -- Create indexes for model_configs with tool isolation
          CREATE INDEX idx_model_configs_provider_tool ON model_configs(provider_id, provider_tool_id);
          CREATE INDEX idx_model_configs_provider ON model_configs(provider_id);
        `,
      },
    ];

    // Run pending migrations in a transaction
    const runMigration = this.db.transaction((migration: (typeof migrations)[0]) => {
      const executed = this.db!.prepare('SELECT id FROM migrations WHERE name = ?').get(
        migration.name
      );

      if (!executed) {
        this.db!.exec(migration.sql);
        this.db!.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      }
    });

    for (const migration of migrations) {
      runMigration(migration);
    }
  }

  /**
   * Prepare commonly used SQL statements for better performance
   */
  private prepareStatements(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Providers - with hybrid tool isolation support
    this.statements.set(
      'provider_insert',
      this.db.prepare(`
      INSERT INTO providers (id, tool_id, name, type, enabled, priority, config, models, default_model, base_url, is_global, is_current_global, is_current_tool, sort_index, category, notes, meta)
      VALUES (@id, @toolId, @name, @type, @enabled, @priority, @config, @models, @defaultModel, @baseUrl, @isGlobal, @isCurrentGlobal, @isCurrentTool, @sortIndex, @category, @notes, @meta)
    `)
    );

    this.statements.set(
      'provider_update',
      this.db.prepare(`
      UPDATE providers
      SET name = @name, type = @type, enabled = @enabled, priority = @priority,
          config = @config, models = @models, default_model = @defaultModel,
          base_url = @baseUrl, is_global = @isGlobal, is_current_global = @isCurrentGlobal,
          is_current_tool = @isCurrentTool, sort_index = @sortIndex, category = @category,
          notes = @notes, meta = @meta, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND tool_id = @toolId
    `)
    );

    this.statements.set(
      'provider_get',
      this.db.prepare("SELECT * FROM providers WHERE id = ? AND tool_id = COALESCE(?, 'global')")
    );

    this.statements.set(
      'provider_get_all',
      this.db.prepare('SELECT * FROM providers ORDER BY priority DESC, name ASC')
    );

    this.statements.set(
      'provider_get_by_id',
      this.db.prepare('SELECT * FROM providers WHERE id = ? LIMIT 1')
    );

    this.statements.set(
      'provider_get_global',
      this.db.prepare(
        "SELECT * FROM providers WHERE is_global = 1 OR tool_id = 'global' ORDER BY priority DESC, name ASC"
      )
    );

    this.statements.set(
      'provider_get_by_tool',
      this.db.prepare('SELECT * FROM providers WHERE tool_id = ? ORDER BY priority DESC, name ASC')
    );

    this.statements.set(
      'provider_get_current_global',
      this.db.prepare(
        'SELECT * FROM providers WHERE is_global = 1 AND is_current_global = 1 LIMIT 1'
      )
    );

    this.statements.set(
      'provider_get_current_tool',
      this.db.prepare('SELECT * FROM providers WHERE tool_id = ? AND is_current_tool = 1 LIMIT 1')
    );

    this.statements.set(
      'provider_delete',
      this.db.prepare("DELETE FROM providers WHERE id = ? AND tool_id = COALESCE(?, 'global')")
    );

    this.statements.set(
      'provider_delete_all_versions',
      this.db.prepare('DELETE FROM providers WHERE id = ?')
    );

    this.statements.set(
      'provider_unset_current_global',
      this.db.prepare('UPDATE providers SET is_current_global = 0 WHERE is_global = 1')
    );

    this.statements.set(
      'provider_set_current_global',
      this.db.prepare(
        "UPDATE providers SET is_current_global = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tool_id = COALESCE(?, 'global')"
      )
    );

    this.statements.set(
      'provider_unset_current_tool',
      this.db.prepare('UPDATE providers SET is_current_tool = 0 WHERE tool_id = ?')
    );

    this.statements.set(
      'provider_set_current_tool',
      this.db.prepare(
        'UPDATE providers SET is_current_tool = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tool_id = ?'
      )
    );

    // API Keys - with tool_id support
    this.statements.set(
      'api_key_insert',
      this.db.prepare(`
      INSERT INTO api_keys (id, provider_id, provider_tool_id, key_name, encrypted_key, iv, auth_tag, is_valid)
      VALUES (@id, @providerId, @providerToolId, @keyName, @encryptedKey, @iv, @authTag, @isValid)
    `)
    );

    this.statements.set(
      'api_key_get_by_provider',
      this.db.prepare(
        "SELECT * FROM api_keys WHERE provider_id = ? AND provider_tool_id = COALESCE(?, 'global')"
      )
    );

    this.statements.set(
      'api_key_get_global',
      this.db.prepare(
        "SELECT * FROM api_keys WHERE provider_id = ? AND provider_tool_id = 'global'"
      )
    );

    this.statements.set(
      'api_key_get_by_tool',
      this.db.prepare('SELECT * FROM api_keys WHERE provider_id = ? AND provider_tool_id = ?')
    );

    this.statements.set('api_key_delete', this.db.prepare('DELETE FROM api_keys WHERE id = ?'));

    // Usage logs
    this.statements.set(
      'usage_log_insert',
      this.db.prepare(`
      INSERT INTO usage_logs (provider_id, model, input_tokens, output_tokens, total_tokens, cost, request_id, metadata)
      VALUES (@providerId, @model, @inputTokens, @outputTokens, @totalTokens, @cost, @requestId, @metadata)
    `)
    );

    // Model configs
    this.statements.set(
      'model_config_insert',
      this.db.prepare(`
      INSERT INTO model_configs (id, provider_id, provider_tool_id, model_id, display_name, context_window, max_output_tokens, pricing_input, pricing_output, enabled, config)
      VALUES (@id, @providerId, @providerToolId, @modelId, @displayName, @contextWindow, @maxOutputTokens, @pricingInput, @pricingOutput, @enabled, @config)
    `)
    );

    this.statements.set(
      'model_config_get_by_provider',
      this.db.prepare(
        "SELECT * FROM model_configs WHERE provider_id = ? AND provider_tool_id = COALESCE(?, 'global') ORDER BY display_name ASC"
      )
    );
  }

  async run(sql: string, params?: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      if (params) {
        this.db.prepare(sql).run(...params);
      } else {
        this.db.exec(sql);
      }
    } catch (error) {
      throw new Error(
        `Database run error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async get<T>(sql: string, params?: any[]): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      if (params) {
        return this.db.prepare(sql).get(...params) as T | undefined;
      }
      return this.db.prepare(sql).get() as T | undefined;
    } catch (error) {
      throw new Error(
        `Database get error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async all<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      if (params) {
        return this.db.prepare(sql).all(...params) as T[];
      }
      return this.db.prepare(sql).all() as T[];
    } catch (error) {
      throw new Error(
        `Database all error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getStatement(name: string): Statement {
    const statement = this.statements.get(name);
    if (!statement) {
      throw new Error(`Statement not found: ${name}`);
    }
    return statement;
  }

  transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.statements.clear();
    }
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  isInitialized(): boolean {
    return this.db !== null;
  }
}
