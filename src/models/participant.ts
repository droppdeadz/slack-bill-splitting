import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";

export interface Participant {
  id: string;
  bill_id: string;
  user_id: string;
  amount: number;
  has_selected: number; // 0 or 1 (SQLite boolean)
  status: "unpaid" | "pending" | "paid";
  paid_at: string | null;
  created_at: string;
}

export function addParticipantsBulk(
  billId: string,
  participants: { userId: string; amount: number }[]
): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO participants (id, bill_id, user_id, amount, status, created_at)
     VALUES (?, ?, ?, ?, 'unpaid', ?)`
  );

  const insertMany = db.transaction(
    (items: { userId: string; amount: number }[]) => {
      const now = new Date().toISOString();
      for (const item of items) {
        stmt.run(uuidv4(), billId, item.userId, item.amount, now);
      }
    }
  );

  insertMany(participants);
}

export function getParticipantById(id: string): Participant | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM participants WHERE id = ?").get(id) as
    | Participant
    | undefined;
}

export function getParticipantsByBill(billId: string): Participant[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM participants WHERE bill_id = ? ORDER BY created_at")
    .all(billId) as Participant[];
}

export function updateParticipantStatus(
  participantId: string,
  status: Participant["status"]
): void {
  const db = getDb();
  const paidAt = status === "paid" ? new Date().toISOString() : null;
  db.prepare(
    "UPDATE participants SET status = ?, paid_at = ? WHERE id = ?"
  ).run(status, paidAt, participantId);
}

export function getParticipantByBillAndUser(
  billId: string,
  userId: string
): Participant | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM participants WHERE bill_id = ? AND user_id = ?")
    .get(billId, userId) as Participant | undefined;
}

export function getUnpaidParticipantsByBill(billId: string): Participant[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM participants WHERE bill_id = ? AND status != 'paid'"
    )
    .all(billId) as Participant[];
}

export function getUnpaidBillsForUser(userId: string): {
  participant: Participant;
  bill_name: string;
  creator_id: string;
  channel_id: string;
  bill_id: string;
}[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.*, b.name as bill_name, b.creator_id, b.channel_id, b.id as bill_id
       FROM participants p
       JOIN bills b ON p.bill_id = b.id
       WHERE p.user_id = ? AND p.status != 'paid' AND b.status = 'active'
       ORDER BY b.created_at DESC`
    )
    .all(userId) as any[];
}

export function areAllParticipantsPaid(billId: string): boolean {
  const db = getDb();
  const result = db
    .prepare(
      "SELECT COUNT(*) as count FROM participants WHERE bill_id = ? AND status != 'paid'"
    )
    .get(billId) as { count: number };
  return result.count === 0;
}

export function markParticipantSelected(participantId: string): void {
  const db = getDb();
  db.prepare("UPDATE participants SET has_selected = 1 WHERE id = ?").run(
    participantId
  );
}

export function haveAllParticipantsSelected(billId: string): boolean {
  const db = getDb();
  const result = db
    .prepare(
      "SELECT COUNT(*) as count FROM participants WHERE bill_id = ? AND has_selected = 0"
    )
    .get(billId) as { count: number };
  return result.count === 0;
}

export function updateParticipantAmount(
  participantId: string,
  amount: number
): void {
  const db = getDb();
  db.prepare("UPDATE participants SET amount = ? WHERE id = ?").run(
    amount,
    participantId
  );
}
