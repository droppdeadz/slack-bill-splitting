import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";

export function setSelectionsForParticipant(
  participantId: string,
  billItemIds: string[]
): void {
  const db = getDb();

  const doTransaction = db.transaction((itemIds: string[]) => {
    // Clear existing selections for this participant
    db.prepare(
      "DELETE FROM item_selections WHERE participant_id = ?"
    ).run(participantId);

    // Insert new selections
    const stmt = db.prepare(
      `INSERT INTO item_selections (id, bill_item_id, participant_id, created_at)
       VALUES (?, ?, ?, ?)`
    );
    const now = new Date().toISOString();
    for (const itemId of itemIds) {
      stmt.run(uuidv4(), itemId, participantId, now);
    }
  });

  doTransaction(billItemIds);
}

export function getAllSelectionsByBill(
  billId: string
): { bill_item_id: string; participant_id: string }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.bill_item_id, s.participant_id
       FROM item_selections s
       JOIN participants p ON s.participant_id = p.id
       WHERE p.bill_id = ?`
    )
    .all(billId) as { bill_item_id: string; participant_id: string }[];
}

/**
 * Get per-participant item breakdowns for a bill.
 * Returns a map of participantId → list of { name, amount (their share) }.
 */
export function getItemBreakdownsByParticipant(
  billId: string
): Map<string, { name: string; amount: number }[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.participant_id, bi.name, bi.amount,
              (SELECT COUNT(*) FROM item_selections s2 WHERE s2.bill_item_id = s.bill_item_id) as selector_count
       FROM item_selections s
       JOIN bill_items bi ON s.bill_item_id = bi.id
       JOIN participants p ON s.participant_id = p.id
       WHERE p.bill_id = ?
       ORDER BY bi.created_at`
    )
    .all(billId) as {
    participant_id: string;
    name: string;
    amount: number;
    selector_count: number;
  }[];

  const map = new Map<string, { name: string; amount: number }[]>();
  for (const row of rows) {
    const shareAmount =
      Math.round((row.amount / row.selector_count) * 100) / 100;
    if (!map.has(row.participant_id)) {
      map.set(row.participant_id, []);
    }
    map.get(row.participant_id)!.push({
      name: row.name,
      amount: shareAmount,
    });
  }
  return map;
}
