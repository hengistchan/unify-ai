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
        `
      }
    ];

    // Run pending migrations in a transaction
    const runMigration = this.db.transaction((migration: typeof migrations[0]) => {
      // Check if migration already executed
      const executed = this.db!.prepare(
        'SELECT id FROM migrations WHERE name = ?'
      ).get(migration.name);

      if (!executed) {
        // Run migration
        this.db!.exec(migration.sql);

        // Record migration
        this.db!.prepare(
          'INSERT INTO migrations (name) VALUES (?)'
        ).run(migration.name);
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

    // Providers
    this.statements.set('provider_insert', this.db.prepare(`
      INSERT INTO providers (id, name, type, enabled, priority, config, models, default_model, base_url)
      VALUES (@id, @name, @type, @enabled, @priority, @config, @models, @defaultModel, @baseUrl)
    `));

    this.statements.set('provider_update', this.db.prepare(`
      UPDATE providers
      SET name = @name, type = @type, enabled = @enabled, priority = @priority,
          config = @config, models = @models, default_model = @defaultModel,
          base_url = @baseUrl, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `));

    this.statements.set('provider_get', this.db.prepare(
      'SELECT * FROM providers WHERE id = ?'
    ));

    this.statements.set('provider_get_all', this.db.prepare(
      'SELECT * FROM providers ORDER BY priority DESC, name ASC'
    ));

    this.statements.set('provider_delete', this.db.prepare(
      'DELETE FROM providers WHERE id = ?'
    ));

    // API Keys
    this.statements.set('api_key_insert', this.db.prepare(`
      INSERT INTO api_keys (id, provider_id, key_name, encrypted_key, iv, auth_tag, is_valid)
      VALUES (@id, @providerId, @keyName, @encryptedKey, @iv, @authTag, @isValid)
    `));

    this.statements.set('api_key_get_by_provider', this.db.prepare(
      'SELECT * FROM api_keys WHERE provider_id = ?'
    ));

    this.statements.set('api_key_delete', this.db.prepare(
      'DELETE FROM api_keys WHERE id = ?'
    ));

    // Usage logs
    this.statements.set('usage_log_insert', this.db.prepare(`
      INSERT INTO usage_logs (provider_id, model, input_tokens, output_tokens, total_tokens, cost, request_id, metadata)
      VALUES (@providerId, @model, @inputTokens, @outputTokens, @totalTokens, @cost, @requestId, @metadata)
    `));

    // Model configs
    this.statements.set('model_config_insert', this.db.prepare(`
      INSERT INTO model_configs (id, provider_id, model_id, display_name, context_window, max_output_tokens, pricing_input, pricing_output, enabled, config)
      VALUES (@id, @providerId, @modelId, @displayName, @contextWindow, @maxOutputTokens, @pricingInput, @pricingOutput, @enabled, @config)
    `));

    this.statements.set('model_config_get_by_provider', this.db.prepare(
      'SELECT * FROM model_configs WHERE provider_id = ? ORDER BY display_name ASC'
    ));
  }

  /**
   * Execute a SQL statement that doesn't return results
   * @param sql - SQL statement
   * @param params - Parameters for prepared statement
   */
  async run(sql: string, params?: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      if (params) {
        this.db.prepare(sql).run(...params);
      } else {
        this.db.exec(sql);
      }
    } catch (error) {
      throw new Error(`Database run error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a SQL query and return a single row
   * @param sql - SQL query
   * @param params - Parameters for prepared statement
   * @returns Single row or undefined
   */
  async get<T>(sql: string, params?: any[]): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      if (params) {
        return this.db.prepare(sql).get(...params) as T | undefined;
      }
      return this.db.prepare(sql).get() as T | undefined;
    } catch (error) {
      throw new Error(`Database get error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a SQL query and return all rows
   * @param sql - SQL query
   * @param params - Parameters for prepared statement
   * @returns Array of rows
   */
  async all<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      if (params) {
        return this.db.prepare(sql).all(...params) as T[];
      }
      return this.db.prepare(sql).all() as T[];
    } catch (error) {
      throw new Error(`Database all error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a prepared statement by name
   * @param name - Statement name
   * @returns Prepared statement
   */
  getStatement(name: string): Statement {
    const statement = this.statements.get(name);
    if (!statement) {
      throw new Error(`Statement not found: ${name}`);
    }
    return statement;
  }

  /**
   * Execute a function within a transaction
   * @param fn - Function to execute
   * @returns Function result
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.statements.clear();
    }
  }

  /**
   * Get database path
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }
}
