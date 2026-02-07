# Phase 5: Payment Integration — Implementation Summary

> Payment method management, PromptPay QR generation, bank account info display, and automatic slip verification.

---

## What Was Built

### 5a: Payment Method Management

**New command: `/<command> payment`**

Users can save both PromptPay and bank account details in a single modal. Both are optional — set up one or both.

- **PromptPay:** Type (phone / national ID / e-Wallet) + ID value
- **Bank Account:** Bank name (dropdown of 12 Thai banks) + account number + holder name

Data is stored as a single row per user in the `payment_methods` table. Running the command again pre-fills existing values for editing.

**Files:**
- `src/models/paymentMethod.ts` — CRUD: `getPaymentMethodByUser()`, `upsertPaymentMethod()`, `removePaymentMethod()`, `hasPromptPay()`, `hasBankAccount()`
- `src/views/paymentModal.ts` — `buildPaymentModal(existing?)` with both sections
- `src/commands/payment.ts` — Modal submission handler + `openPaymentModal()` helper
- `src/database/schema.ts` — `payment_methods` table in `initializeDatabase()`
- `src/database/migrate.ts` — Migration `002_create_payment_methods`

### 5b: Bill Card Payment Buttons + QR Generation

**Bill card buttons (active bills only):**
- Creator has PromptPay → `[Pay via PromptPay]`
- Creator has bank account → `[Payment Info]`
- Creator has both → both buttons shown
- Creator has neither → no extra buttons (same as before)
- Always: `[Mark as Paid] [Manage Bill]`

**"Pay via PromptPay" flow:**
1. Generates PromptPay QR code using `promptpay-qr` + `qrcode` (PNG buffer)
2. Uploads QR image to Slack via `files.uploadV2()` (requires `files:write` scope)
3. Shows ephemeral message with QR image, amount, and instructions

**"Payment Info" flow:**
- Shows bank name, masked account number (last 4 digits), and holder name as ephemeral message

**Edge cases handled:**
- Creator clicks own payment buttons → "You're the bill owner"
- Non-participant clicks → error
- Already-paid participant → notification

**Dependencies:** `promptpay-qr`, `qrcode`, `@types/qrcode`

**Files:**
- `src/services/promptPayQr.ts` — `generatePromptPayQr(id, amount)`
- `src/views/paymentInfoMessage.ts` — `buildPromptPayQrBlocks()`, `buildBankInfoBlocks()`
- `src/actions/paymentInfo.ts` — `registerPaymentInfoAction(app)` (both button handlers)
- `src/views/billCard.ts` — Updated `buildBillCard()` and `buildActiveCard()` to accept `creatorPaymentMethod?`

**All `buildBillCard()` call sites updated to pass creator's payment method:**
- `src/commands/create.ts`
- `src/actions/confirmPayment.ts`
- `src/actions/completeCalc.ts`
- `src/actions/cancelBill.ts`
- `src/actions/viewDetails.ts`

### 5c: Slip Verification via OpenSlipVerify

**Flow (when `OPENSLIPVERIFY_API_KEY` is set):**
1. Participant uploads a payment slip image via "Mark as Paid"
2. Bot downloads the image from Slack
3. Decodes to RGBA pixels with `sharp`
4. Extracts QR code data with `jsQR`
5. Parses the EMVCo QR with `promptparse` to get `transRef` (tag 62, sub-tag 05)
6. POSTs to `https://api.openslipverify.com/` with `{ refNbr, amount, token }`
7. Inserts verification result into creator's DM notification:
   - Success: green check with transaction details (ref, amount, sender, receiver, date)
   - Failure: warning with error message

**Graceful fallback:** If QR extraction fails, API is unavailable, API key is not set, or the file isn't an image — verification is skipped silently. Creator still sees the slip and can confirm/reject manually.

**Dependencies:** `jsqr`, `sharp`, `promptparse`

**Files:**
- `src/services/slipVerify.ts` — `verifySlip(fileId, amount, client)`
- `src/actions/markPaid.ts` — Calls `verifySlip()` after slip upload, adds result block to creator DM

---

## Database

**Table: `payment_methods`**

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | UUID |
| user_id | TEXT (UNIQUE) | Slack user ID |
| promptpay_type | TEXT | "phone", "national_id", "ewallet", or null |
| promptpay_id | TEXT | PromptPay ID value, or null |
| bank_name | TEXT | e.g. "KBank", or null |
| bank_account_number | TEXT | Account number, or null |
| bank_account_name | TEXT | Holder display name, or null |
| created_at | DATETIME | Timestamp |
| updated_at | DATETIME | Timestamp |

---

## New Environment Variable

```env
OPENSLIPVERIFY_API_KEY=     # Optional: API key from https://openslipverify.com (500 slips/day free)
```

## New Slack Scope

- `files:write` — Required for uploading PromptPay QR code images via `files.uploadV2()`

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `promptpay-qr` | ^0.5.0 | Generate PromptPay EMVCo QR payload |
| `qrcode` | ^1.5.4 | Render QR payload to PNG buffer |
| `@types/qrcode` | ^1.5.6 | TypeScript types for qrcode |
| `jsqr` | ^1.4.0 | Extract QR code data from images |
| `sharp` | ^0.34.5 | Image processing (decode to RGBA pixels) |
| `promptparse` | ^1.5.0 | Parse EMVCo QR data (extract transaction ref) |
