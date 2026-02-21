/**
 * ModelDatabase Unit Tests
 * Tests database initialization, migrations, and CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelDatabase } from '../../model/Database';
import type { AIProvider } from '../../model/types';

describe('ModelDatabase', () => {
  let db: ModelDatabase;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new ModelDatabase(':memory:');
  });

  afterEach(async () => {
    await db.close();
  });

  describe('initialize', () => {
    it('should initialize database successfully', async () => {
      await db.initialize();

      expect(db.isInitialized()).toBe(true);
    });

    it('should create all required tables', async () => {
      await db.initialize();

      const tables = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('providers');
      expect(tableNames).toContain('api_keys');
      expect(tableNames).toContain('usage_logs');
      expect(tableNames).toContain('model_configs');
      expect(tableNames).toContain('migrations');
    });

    it('should create indexes for better performance', async () => {
      await db.initialize();

      const indexes = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
      );

      const indexNames = indexes.map(i => i.name);

      expect(indexNames).toContain('idx_api_keys_provider');
      expect(indexNames).toContain('idx_usage_logs_provider');
      expect(indexNames).toContain('idx_usage_logs_timestamp');
      expect(indexNames).toContain('idx_model_configs_provider');
    });

    it('should enable foreign key constraints', async () => {
      await db.initialize();

      const result = await db.get<{ foreign_keys: number }>(
        'PRAGMA foreign_keys'
      );

      expect(result?.foreign_keys).toBe(1);
    });

    it('should run migrations only once', async () => {
      await db.initialize();

      const migrations = await db.all<{ name: string }>(
        'SELECT name FROM migrations ORDER BY name'
      );

      expect(migrations).toHaveLength(3);
      expect(migrations[0].name).toBe('001_initial_schema');
      expect(migrations[1].name).toBe('002_usage_aggregation');
      expect(migrations[2].name).toBe('003_hybrid_tool_isolation');

      // Initialize again - should not add duplicate migrations
      await db.close();
      db = new ModelDatabase(':memory:');
      await db.initialize();

      const migrations2 = await db.all<{ name: string }>(
        'SELECT name FROM migrations ORDER BY name'
      );

      expect(migrations2).toHaveLength(3);
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    describe('run()', () => {
      it('should execute SQL without parameters', async () => {
        await db.run('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');

        const result = await db.get<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
        );

        expect(result?.name).toBe('test_table');
      });

      it('should execute SQL with parameters', async () => {
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['test-provider', 'Test Provider', 'openai-compatible', 1, 50]
        );

        const result = await db.get<AIProvider>(
          'SELECT * FROM providers WHERE id = ?',
          ['test-provider']
        );

        expect(result).toBeDefined();
        expect(result?.name).toBe('Test Provider');
      });

      it('should throw error on invalid SQL', async () => {
        await expect(
          db.run('INVALID SQL STATEMENT')
        ).rejects.toThrow('Database run error');
      });
    });

    describe('get()', () => {
      it('should return single row', async () => {
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['provider1', 'Provider 1', 'openai-compatible', 1, 100]
        );

        const result = await db.get<AIProvider>(
          'SELECT * FROM providers WHERE id = ?',
          ['provider1']
        );

        expect(result).toBeDefined();
        expect(result?.id).toBe('provider1');
        expect(result?.name).toBe('Provider 1');
      });

      it('should return undefined for non-existent row', async () => {
        const result = await db.get<AIProvider>(
          'SELECT * FROM providers WHERE id = ?',
          ['non-existent']
        );

        expect(result).toBeUndefined();
      });

      it('should return row without parameters', async () => {
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['provider1', 'Provider 1', 'openai-compatible', 1, 100]
        );

        const result = await db.get<AIProvider>(
          "SELECT * FROM providers WHERE id = 'provider1'"
        );

        expect(result).toBeDefined();
        expect(result?.id).toBe('provider1');
      });
    });

    describe('all()', () => {
      it('should return all matching rows', async () => {
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['provider1', 'Provider 1', 'openai-compatible', 1, 100]
        );
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['provider2', 'Provider 2', 'anthropic', 1, 90]
        );
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['provider3', 'Provider 3', 'azure', 0, 80]
        );

        const results = await db.all<AIProvider>(
          'SELECT * FROM providers ORDER BY priority DESC'
        );

        expect(results).toHaveLength(3);
        expect(results[0].id).toBe('provider1');
        expect(results[1].id).toBe('provider2');
        expect(results[2].id).toBe('provider3');
      });

      it('should return empty array for no matches', async () => {
        const results = await db.all<AIProvider>(
          'SELECT * FROM providers WHERE enabled = 0'
        );

        expect(results).toEqual([]);
      });

      it('should support parameterized queries', async () => {
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['provider1', 'Provider 1', 'openai-compatible', 1, 100]
        );
        await db.run(
          'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
          ['provider2', 'Provider 2', 'anthropic', 1, 90]
        );

        const results = await db.all<AIProvider>(
          'SELECT * FROM providers WHERE type = ? ORDER BY priority DESC',
          ['openai-compatible']
        );

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('provider1');
      });
    });
  });

  describe('prepared statements', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('should prepare provider statements', () => {
      expect(() => db.getStatement('provider_insert')).not.toThrow();
      expect(() => db.getStatement('provider_update')).not.toThrow();
      expect(() => db.getStatement('provider_get')).not.toThrow();
      expect(() => db.getStatement('provider_get_all')).not.toThrow();
      expect(() => db.getStatement('provider_delete')).not.toThrow();
    });

    it('should prepare API key statements', () => {
      expect(() => db.getStatement('api_key_insert')).not.toThrow();
      expect(() => db.getStatement('api_key_get_by_provider')).not.toThrow();
      expect(() => db.getStatement('api_key_delete')).not.toThrow();
    });

    it('should prepare usage log statements', () => {
      expect(() => db.getStatement('usage_log_insert')).not.toThrow();
    });

    it('should prepare model config statements', () => {
      expect(() => db.getStatement('model_config_insert')).not.toThrow();
      expect(() => db.getStatement('model_config_get_by_provider')).not.toThrow();
    });

    it('should throw error for non-existent statement', () => {
      expect(() => db.getStatement('non_existent')).toThrow('Statement not found: non_existent');
    });

    it('should use prepared statements for inserts', () => {
      const stmt = db.getStatement('provider_insert');

      const result = stmt.run({
        id: 'test-provider',
        toolId: 'global',
        name: 'Test Provider',
        type: 'openai-compatible',
        enabled: 1,
        priority: 50,
        config: null,
        models: null,
        defaultModel: null,
        baseUrl: null,
        isGlobal: 1,
        isCurrentGlobal: 0,
        isCurrentTool: 0,
        sortIndex: 50,
        category: 'third-party',
        notes: null,
        meta: '{}',
      });

      expect(result.changes).toBe(1);
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('should execute function in transaction', () => {
      const result = db.transaction(() => {
        const stmt = db.getStatement('provider_insert');

        stmt.run({
          id: 'provider1',
          toolId: 'global',
          name: 'Provider 1',
          type: 'openai-compatible',
          enabled: 1,
          priority: 100,
          config: null,
          models: null,
          defaultModel: null,
          baseUrl: null,
          isGlobal: 1,
          isCurrentGlobal: 0,
          isCurrentTool: 0,
          sortIndex: 100,
          category: 'third-party',
          notes: null,
          meta: '{}',
        });

        stmt.run({
          id: 'provider2',
          toolId: 'global',
          name: 'Provider 2',
          type: 'anthropic',
          enabled: 1,
          priority: 90,
          config: null,
          models: null,
          defaultModel: null,
          baseUrl: null,
          isGlobal: 1,
          isCurrentGlobal: 0,
          isCurrentTool: 0,
          sortIndex: 90,
          category: 'third-party',
          notes: null,
          meta: '{}',
        });

        return 'success';
      });

      expect(result).toBe('success');

      const providers = db.getStatement('provider_get_all').all();
      expect(providers).toHaveLength(2);
    });

    it('should rollback on error', () => {
      expect(() => {
        db.transaction(() => {
          const stmt = db.getStatement('provider_insert');

          stmt.run({
            id: 'provider1',
            toolId: 'global',
            name: 'Provider 1',
            type: 'openai-compatible',
            enabled: 1,
            priority: 100,
            config: null,
            models: null,
            defaultModel: null,
            baseUrl: null,
            isGlobal: 1,
            isCurrentGlobal: 0,
            isCurrentTool: 0,
            sortIndex: 100,
            category: 'third-party',
            notes: null,
            meta: '{}',
          });

          // This will cause an error
          throw new Error('Transaction error');
        });
      }).toThrow('Transaction error');

      // Data should be rolled back
      const providers = db.getStatement('provider_get_all').all();
      expect(providers).toHaveLength(0);
    });
  });

  describe('foreign key constraints', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('should enforce foreign key constraint on api_keys', async () => {
      await expect(
        db.run(
          'INSERT INTO api_keys (id, provider_id, encrypted_key) VALUES (?, ?, ?)',
          ['key1', 'non-existent-provider', Buffer.from('test')]
        )
      ).rejects.toThrow();
    });

    it('should cascade delete api_keys when provider is deleted', async () => {
      // Insert provider
      await db.run(
        'INSERT INTO providers (id, name, type, enabled, priority) VALUES (?, ?, ?, ?, ?)',
        ['provider1', 'Provider 1', 'openai-compatible', 1, 100]
      );

      // Insert API key
      await db.run(
        'INSERT INTO api_keys (id, provider_id, encrypted_key) VALUES (?, ?, ?)',
        ['key1', 'provider1', Buffer.from('test')]
      );

      // Delete provider
      await db.run('DELETE FROM providers WHERE id = ?', ['provider1']);

      // API key should be deleted too
      const keys = await db.all('SELECT * FROM api_keys WHERE provider_id = ?', ['provider1']);
      expect(keys).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await db.initialize();

      expect(db.isInitialized()).toBe(true);

      await db.close();

      expect(db.isInitialized()).toBe(false);
    });

    it('should be safe to call close multiple times', async () => {
      await db.initialize();
      await db.close();
      await db.close(); // Should not throw

      expect(db.isInitialized()).toBe(false);
    });

    it('should clear prepared statements on close', async () => {
      await db.initialize();

      // Should work before close
      expect(() => db.getStatement('provider_insert')).not.toThrow();

      await db.close();

      // Should throw after close (statements cleared)
      expect(() => db.getStatement('provider_insert')).toThrow('Statement not found: provider_insert');
    });
  });

  describe('getDatabasePath', () => {
    it('should return custom database path', () => {
      const customDb = new ModelDatabase('/custom/path.db');
      expect(customDb.getDatabasePath()).toBe('/custom/path.db');
    });

    it('should return default path when not specified', () => {
      const defaultDb = new ModelDatabase();
      const path = defaultDb.getDatabasePath();

      expect(path).toContain('.unify-ai');
      expect(path).toContain('models.db');
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(db.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await db.initialize();
      expect(db.isInitialized()).toBe(true);
    });

    it('should return false after close', async () => {
      await db.initialize();
      await db.close();
      expect(db.isInitialized()).toBe(false);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('should throw error when using database before initialization', async () => {
      const uninitializedDb = new ModelDatabase(':memory:');

      await expect(uninitializedDb.run('SELECT 1')).rejects.toThrow('Database not initialized');
      await expect(uninitializedDb.get('SELECT 1')).rejects.toThrow('Database not initialized');
      await expect(uninitializedDb.all('SELECT 1')).rejects.toThrow('Database not initialized');

      expect(() => uninitializedDb.transaction(() => {})).toThrow('Database not initialized');
    });

    it('should handle SQL errors gracefully', async () => {
      await expect(
        db.run('SELECT * FROM non_existent_table')
      ).rejects.toThrow('Database run error');
    });
  });
});
