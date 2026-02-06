import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";
import { config } from "../config";

export interface Bill {
  id: string;
  name: string;
  total_amount: number;
  currency: string;
  split_type: "equal" | "custom";
  creator_id: string;
  channel_id: string;
  message_ts: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface CreateBillInput {
  name: string;
  totalAmount: number;
  splitType: "equal" | "custom";
  creatorId: string;
  channelId: string;
}

export function createBill(input: CreateBillInput): Bill {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO bills (id, name, total_amount, currency, split_type, creator_id, channel_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(
    id,
    input.name,
    input.totalAmount,
    config.defaultCurrency,
    input.splitType,
    input.creatorId,
    input.channelId,
    now,
    now
  );

  return getBillById(id)!;
}

export function getBillById(id: string): Bill | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM bills WHERE id = ?").get(id) as
    | Bill
    | undefined;
}

export function updateBillMessageTs(
  billId: string,
  messageTs: string
): void {
  const db = getDb();
  db.prepare("UPDATE bills SET message_ts = ?, updated_at = ? WHERE id = ?").run(
    messageTs,
    new Date().toISOString(),
    billId
  );
}

export function updateBillStatus(
  billId: string,
  status: Bill["status"]
): void {
  const db = getDb();
  db.prepare("UPDATE bills SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    new Date().toISOString(),
    billId
  );
}

export function getActiveBillsByChannel(channelId: string): Bill[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM bills WHERE channel_id = ? AND status = 'active' ORDER BY created_at DESC"
    )
    .all(channelId) as Bill[];
}

export function getBillsByCreator(
  creatorId: string,
  status?: Bill["status"]
): Bill[] {
  const db = getDb();
  if (status) {
    return db
      .prepare(
        "SELECT * FROM bills WHERE creator_id = ? AND status = ? ORDER BY created_at DESC"
      )
      .all(creatorId, status) as Bill[];
  }
  return db
    .prepare("SELECT * FROM bills WHERE creator_id = ? ORDER BY created_at DESC")
    .all(creatorId) as Bill[];
}

export function getCompletedBillsByChannel(channelId: string): Bill[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM bills WHERE channel_id = ? AND status IN ('completed', 'cancelled') ORDER BY updated_at DESC LIMIT 20"
    )
    .all(channelId) as Bill[];
}
