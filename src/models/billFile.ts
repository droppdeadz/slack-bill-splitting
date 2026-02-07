import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";

export interface BillFile {
  id: string;
  bill_id: string;
  slack_file_id: string;
  file_type: "payment_slip" | "receipt_image" | "promptpay_qr";
  uploaded_by: string;
  created_at: string;
  deleted_at: string | null;
}

export function trackBillFile(
  billId: string,
  slackFileId: string,
  fileType: BillFile["file_type"],
  uploadedBy: string
): void {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO bill_files (id, bill_id, slack_file_id, file_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, billId, slackFileId, fileType, uploadedBy);
}

export interface FileForCleanup {
  id: string;
  slack_file_id: string;
  file_type: string;
  uploaded_by: string;
}

export function getFilesForCleanup(days = 7): FileForCleanup[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT bf.id, bf.slack_file_id, bf.file_type, bf.uploaded_by
       FROM bill_files bf
       JOIN bills b ON bf.bill_id = b.id
       WHERE bf.deleted_at IS NULL
         AND b.status IN ('completed', 'cancelled')
         AND b.updated_at <= datetime('now', '-' || ? || ' days')`
    )
    .all(days) as FileForCleanup[];
}

export function markFileDeleted(id: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE bill_files SET deleted_at = datetime('now') WHERE id = ?`
  ).run(id);
}
