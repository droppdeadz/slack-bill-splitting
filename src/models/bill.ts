import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";
import { config } from "../config";

export interface Bill {
  id: string;
  name: string;
  total_amount: number;
  currency: string;
  split_type: "equal" | "item";
  creator_id: string;
  channel_id: string;
  message_ts: string | null;
  status: "pending" | "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface CreateBillInput {
  name: string;
  totalAmount: number;
  splitType: "equal" | "item";
  creatorId: string;
  channelId: string;
}

export function createBill(input: CreateBillInput): Bill {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const initialStatus = input.splitType === "item" ? "pending" : "active";

  db.prepare(
    `INSERT INTO bills (id, name, total_amount, currency, split_type, creator_id, channel_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.totalAmount,
    config.defaultCurrency,
    input.splitType,
    input.creatorId,
    input.channelId,
    initialStatus,
    now,
    now
  );

  const bill = getBillById(id);
  if (!bill) throw new Error(`Failed to retrieve bill after insert: ${id}`);
  return bill;
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
      "SELECT * FROM bills WHERE channel_id = ? AND status IN ('active', 'pending') ORDER BY created_at DESC"
    )
    .all(channelId) as Bill[];
}

export function getActiveBillsByChannelAndCreator(
  channelId: string,
  creatorId: string
): Bill[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM bills WHERE channel_id = ? AND creator_id = ? AND status IN ('active', 'pending') ORDER BY created_at DESC"
    )
    .all(channelId, creatorId) as Bill[];
}

export function getActiveBillsOwedByUserInChannel(
  channelId: string,
  userId: string
): Bill[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT b.* FROM bills b
       JOIN participants p ON p.bill_id = b.id
       WHERE b.channel_id = ? AND b.status IN ('active', 'pending')
         AND p.user_id = ? AND p.status != 'paid'
       ORDER BY b.created_at DESC`
    )
    .all(channelId, userId) as Bill[];
}

export function getCompletedBillsByChannel(channelId: string): Bill[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM bills WHERE channel_id = ? AND status IN ('completed', 'cancelled') ORDER BY updated_at DESC LIMIT 20"
    )
    .all(channelId) as Bill[];
}
