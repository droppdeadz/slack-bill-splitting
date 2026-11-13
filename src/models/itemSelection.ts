import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";
import { getItemsByBill } from "./billItem";
import {
  calculateItemSplits,
  type ItemSplitResult,
  type ShareLine,
} from "../utils/splitCalculator";

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
 * Calculate Shares, per-participant breakdowns and Unselected Items for an
 * Item-based Bill from its current Selections.
 */
export function getItemSplitForBill(billId: string): ItemSplitResult {
  const db = getDb();
  const creator = db
    .prepare(
      `SELECT p.id FROM participants p
       JOIN bills b ON b.id = p.bill_id
       WHERE p.bill_id = ? AND p.user_id = b.creator_id`
    )
    .get(billId) as { id: string } | undefined;
  if (!creator) {
    throw new Error(`Bill ${billId} has no Creator participant`);
  }

  return calculateItemSplits(
    getItemsByBill(billId),
    getAllSelectionsByBill(billId),
    creator.id
  );
}

/**
 * Get per-participant item breakdowns for a bill.
 * Returns a map of participantId → the lines that make up their Share.
 */
export function getItemBreakdownsByParticipant(
  billId: string
): Map<string, ShareLine[]> {
  return getItemSplitForBill(billId).breakdowns;
}
