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
    } catch (err: any) {
      // Skip if column already exists (e.g. fresh DB created with full schema)
      if (err.message?.includes("duplicate column name")) {
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
