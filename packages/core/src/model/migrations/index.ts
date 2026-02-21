import type Database from 'better-sqlite3';
import { migration_001 } from './001_initial';
import { migration_002 } from './002_usage_aggregation';

export const migrations = [
  { version: 1, sql: migration_001 },
  { version: 2, sql: migration_002 }
];

export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get applied migrations
  const appliedMigrations = db
    .prepare('SELECT version FROM _migrations')
    .all() as Array<{ version: number }>;

  const appliedVersions = new Set(appliedMigrations.map(m => m.version));

  // Run each migration in transaction
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    const runMigration = db.transaction(() => {
      // Execute the migration SQL
      db.exec(migration.sql);

      // Record the migration
      db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(migration.version);
    });

    runMigration();
  }
}
