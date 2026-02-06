import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";

export interface BillItem {
  id: string;
  bill_id: string;
  name: string;
  amount: number;
  created_at: string;
}

export function addBillItemsBulk(
  billId: string,
  items: { name: string; amount: number }[]
): BillItem[] {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO bill_items (id, bill_id, name, amount, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  const ids: string[] = [];
  const insertMany = db.transaction(
    (itemList: { name: string; amount: number }[]) => {
      const now = new Date().toISOString();
      for (const item of itemList) {
        const id = uuidv4();
        ids.push(id);
        stmt.run(id, billId, item.name, item.amount, now);
      }
    }
  );

  insertMany(items);
  return getItemsByBill(billId);
}

export function getItemsByBill(billId: string): BillItem[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM bill_items WHERE bill_id = ? ORDER BY created_at"
    )
    .all(billId) as BillItem[];
}

export function getBillItemById(id: string): BillItem | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM bill_items WHERE id = ?").get(id) as
    | BillItem
    | undefined;
}
