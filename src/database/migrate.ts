import { getDb, closeDb } from "./connection";

interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

const migrations: { name: string; up: string }[] = [
  {
    name: "001_add_has_selected_to_participants",
    up: `ALTER TABLE participants ADD COLUMN has_selected INTEGER NOT NULL DEFAULT 0`,
  },
  {
    name: "002_create_payment_methods",
    up: `CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      promptpay_type TEXT,
      promptpay_id TEXT,
      bank_name TEXT,
      bank_account_number TEXT,
      bank_account_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: "003_create_bill_files",
    up: `CREATE TABLE IF NOT EXISTS bill_files (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      slack_file_id TEXT NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_bill_files_bill ON bill_files(bill_id);
    CREATE INDEX IF NOT EXISTS idx_bill_files_pending ON bill_files(deleted_at)`,
  },
];

export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = db
    .prepare("SELECT name FROM migrations")
    .all() as MigrationRecord[];
  const appliedNames = new Set(applied.map((m) => m.name));

  let count = 0;
  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) continue;

    try {
      db.exec(migration.up);
    } catch (err: unknown) {
      // Skip if column already exists (e.g. fresh DB created with full schema)
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("duplicate column name")) {
        console.log(`[Migrate] Skipping ${migration.name} (already applied)`);
      } else {
        throw err;
      }
    }

    db.prepare("INSERT INTO migrations (name) VALUES (?)").run(migration.name);
    console.log(`[Migrate] Applied: ${migration.name}`);
    count++;
  }

  if (count === 0) {
    console.log("[Migrate] Database is up to date");
  } else {
    console.log(`[Migrate] Applied ${count} migration(s)`);
  }
}

// Run directly via CLI: pnpm db:migrate
if (require.main === module || process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations();
  closeDb();
}
