import { getDb } from "./connection";

export function initializeDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'THB',
      split_type TEXT NOT NULL DEFAULT 'equal',
      creator_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_ts TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bills_channel ON bills(channel_id);
    CREATE INDEX IF NOT EXISTS idx_bills_creator ON bills(creator_id);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
    CREATE INDEX IF NOT EXISTS idx_participants_bill ON participants(bill_id);
    CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
  `);

  console.log("[DB] Database initialized successfully");
}
