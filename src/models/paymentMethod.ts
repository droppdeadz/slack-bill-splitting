import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/connection";

export interface PaymentMethod {
  id: string;
  user_id: string;
  promptpay_type: "phone" | "national_id" | "ewallet" | null;
  promptpay_id: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  created_at: string;
  updated_at: string;
}

export function getPaymentMethodByUser(
  userId: string
): PaymentMethod | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM payment_methods WHERE user_id = ?")
    .get(userId) as PaymentMethod | undefined;
}

export function upsertPaymentMethod(
  userId: string,
  data: {
    promptpayType?: string | null;
    promptpayId?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  }
): PaymentMethod {
  const db = getDb();
  const existing = getPaymentMethodByUser(userId);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(
      `UPDATE payment_methods
       SET promptpay_type = ?, promptpay_id = ?,
           bank_name = ?, bank_account_number = ?, bank_account_name = ?,
           updated_at = ?
       WHERE user_id = ?`
    ).run(
      data.promptpayType ?? null,
      data.promptpayId ?? null,
      data.bankName ?? null,
      data.bankAccountNumber ?? null,
      data.bankAccountName ?? null,
      now,
      userId
    );
  } else {
    db.prepare(
      `INSERT INTO payment_methods
       (id, user_id, promptpay_type, promptpay_id, bank_name, bank_account_number, bank_account_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      userId,
      data.promptpayType ?? null,
      data.promptpayId ?? null,
      data.bankName ?? null,
      data.bankAccountNumber ?? null,
      data.bankAccountName ?? null,
      now,
      now
    );
  }

  return getPaymentMethodByUser(userId)!;
}

export function removePaymentMethod(userId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM payment_methods WHERE user_id = ?").run(userId);
}

export function hasPromptPay(pm: PaymentMethod | undefined): boolean {
  return !!(pm?.promptpay_type && pm?.promptpay_id);
}

export function hasBankAccount(pm: PaymentMethod | undefined): boolean {
  return !!(pm?.bank_name && pm?.bank_account_number);
}
