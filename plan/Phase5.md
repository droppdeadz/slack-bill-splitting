# Phase 5: Payment Integration

> Generate PromptPay QR codes for easy payment and optionally verify payment slips automatically via e-Slip APIs.

---

## Overview

Phase 5 adds real payment integration to the bill-splitting bot. Currently, payments happen outside the bot (cash, bank transfer, etc.) and the creator manually confirms each payment. This phase streamlines that by:

1. **PromptPay QR Generation** — Participants can generate a QR code with the creator's PromptPay ID and the exact amount pre-filled. They scan it with any Thai banking app to transfer money instantly.
2. **Slip Verification (Optional)** — When a participant uploads a payment slip, the bot can automatically verify it against an e-Slip API to confirm the transaction is real, reducing manual confirmation burden on the creator.

---

## User Flows After Phase 5

### Complete End-to-End Flow (Equal Split Example)

```
1. Creator types: /<command> create
   -> Modal opens, creator fills in:
      - Bill name: "Taxi to airport"
      - Split type: Equal
      - Total amount: ฿400
      - Participants: @Alice, @Bob, @Charlie

2. Bot posts bill card in channel
   -> Creator auto-included and auto-marked as paid (฿100)
   -> @Alice, @Bob, @Charlie each owe ฿100

3. @Alice clicks "Pay via PromptPay" on the bill card
   -> Bot checks if the creator has a PromptPay ID saved
      - If yes: generates QR code with creator's PromptPay ID + ฿100
      - If no: shows message asking the creator to set up PromptPay
   -> Bot sends @Alice an ephemeral message with the QR code image
   -> @Alice opens her banking app, scans the QR, transfers ฿100

4. @Alice clicks "Mark as Paid" on the bill card
   -> Modal opens: optionally upload payment slip
   -> @Alice uploads her bank transfer screenshot
   -> Bot sends DM to creator with slip + Confirm/Reject buttons

5. (Optional — if slip verification is enabled)
   -> Bot automatically calls e-Slip API to verify the transaction
   -> Verification result shown to creator alongside the slip:
      "✅ Verified: ฿100 transferred from KBank to SCB at 14:32"
   -> Creator can still manually confirm/reject

6. Creator clicks "Confirm"
   -> @Alice marked as paid, bill card updates
   -> Repeat for @Bob, @Charlie
   -> When all paid: bill auto-completes
```

### Complete End-to-End Flow (Item-based Split Example)

```
1. Creator types: /<command> create
   -> Fills in items: "Salmon Sushi ฿350", "Ramen ฿280", "Gyoza ฿340"
   -> Selects participants: @Alice, @Bob

2. Bot posts bill card (status: pending)
   -> Bot DMs @Alice and @Bob with item selection checklists

3. @Alice selects: Salmon Sushi, Ramen
   @Bob selects: Ramen, Gyoza
   -> Bill card updates: "2/2 completed"

4. Creator clicks "Complete Calculation"
   -> @Alice owes: ฿350 + ฿140 = ฿490 (Salmon Sushi full + half Ramen)
   -> @Bob owes: ฿140 + ฿340 = ฿480 (half Ramen + Gyoza full)
   -> Creator auto-marked as paid
   -> Bill moves to active payment tracking

5. @Alice clicks "Pay via PromptPay"
   -> QR code generated: creator's PromptPay ID + ฿490
   -> @Alice scans, pays, then marks as paid with slip

6. Same flow continues for @Bob
   -> Bill auto-completes when everyone has paid
```

---

## Feature Breakdown

### 5.1 — PromptPay ID Management

Bill creators need to register their PromptPay ID (phone number or national ID) so the bot can generate QR codes for participants to pay them.

**New command: `/<command> promptpay`**

```
User types: /<command> promptpay
  -> Modal opens:
     - PromptPay ID type: Phone Number / National ID / e-Wallet ID
     - PromptPay ID value: (masked input)
  -> Saved to database
  -> Ephemeral confirmation: "✅ PromptPay ID saved! Participants can now
     generate QR codes to pay you directly."

User types: /<command> promptpay
  (if already saved)
  -> Modal shows current ID (masked: 08x-xxx-x789)
  -> Options: Update / Remove
```

**Privacy:**
- PromptPay IDs are stored encrypted or hashed in the database
- Only the QR code is shared with participants (they see the QR image, not the raw ID)
- Users can remove their PromptPay ID at any time

### 5.2 — PromptPay QR Code Generation

When a participant wants to pay, they click a button on the bill card to get a QR code.

**New button on bill card: "Pay via PromptPay"**

```
Participant clicks "Pay via PromptPay"
  -> Bot checks:
     1. Bill is in "active" status
     2. Participant is on the bill and unpaid
     3. Creator has a saved PromptPay ID
  -> Generates PromptPay QR code payload using `promptpay-qr` library
  -> Renders QR code image using `qrcode` library
  -> Sends ephemeral message to participant with:
     - QR code image
     - Amount: ฿XXX
     - Recipient hint: "Pay to @creator"
     - Instructions: "Scan this QR code with your banking app"
     - "Mark as Paid" button (convenience shortcut)
```

**Bill card button layout (active state):**
```
[Pay via PromptPay]  [Mark as Paid]  [Manage Bill]
```

- "Pay via PromptPay" only appears if the creator has a PromptPay ID saved
- If no PromptPay ID: falls back to current flow (just "Mark as Paid")

### 5.3 — Slip Verification (Optional Enhancement)

When a participant uploads a payment slip during "Mark as Paid", the bot can auto-verify it.

**Flow:**
```
Participant uploads slip in "Mark as Paid" modal
  -> Bot extracts the QR code from the slip image
  -> Calls e-Slip verification API with the transaction reference
  -> API returns: sender, receiver, amount, timestamp, bank, status
  -> Bot validates:
     1. Amount matches (or is close to) the participant's owed amount
     2. Transaction is recent (within reasonable timeframe)
  -> Shows verification result to creator in the confirmation DM:

     "@Alice says they paid ฿490 for 'Lunch at Sushi Place'"
     [Slip Image]
     ✅ Slip Verified
     ├─ Amount: ฿490.00
     ├─ From: KBank (xxx-x-x1234-x)
     ├─ To: SCB (xxx-x-x5678-x)
     ├─ Date: 7 Feb 2026, 14:32
     └─ Ref: 2026020712345678
     [Confirm Payment]  [Reject]

  Or if verification fails:
     ⚠️ Could not verify slip
     ├─ Reason: Amount mismatch (slip: ฿400, expected: ฿490)
     [Confirm Payment]  [Reject]
```

**Supported verification providers (configurable):**

| Provider | Type | Cost | Limits |
|----------|------|------|--------|
| [OpenSlipVerify](https://openslipverify.com/) | Free API | Free | 500 slips/day |
| [EasySlip](https://developer.easyslip.com/) | Freemium API | Free tier available | Varies by plan |
| None (manual) | Default | Free | Unlimited |

The verification provider is configurable via environment variable. When set to `none` (default), the bot behaves exactly as it does today — creator manually confirms.

---

## Technical Implementation

### New Dependencies

| Package | Purpose |
|---------|---------|
| [`promptpay-qr`](https://www.npmjs.com/package/promptpay-qr) | Generate PromptPay QR code payload string from phone/ID + amount |
| [`qrcode`](https://www.npmjs.com/package/qrcode) | Render QR code payload string into PNG image buffer |

### New Files

```
src/
├── commands/
│   └── promptpay.ts           # /<command> promptpay — save/update/remove PromptPay ID
├── actions/
│   └── payViaPromptPay.ts     # "Pay via PromptPay" button handler
├── views/
│   ├── promptPayModal.ts      # Modal for saving PromptPay ID
│   └── promptPayQrMessage.ts  # Ephemeral message with QR code image
├── services/
│   ├── promptPayQr.ts         # PromptPay QR code generation (payload + image)
│   └── slipVerify.ts          # Slip verification API wrapper (optional)
└── models/
    └── promptPayId.ts         # CRUD for promptpay_ids table
```

### Modified Files

| File | Changes |
|------|---------|
| `src/app.ts` | Register new command (`promptpay`) and action (`pay_via_promptpay`) |
| `src/views/billCard.ts` | Add "Pay via PromptPay" button (conditional on creator having PromptPay ID) |
| `src/actions/markPaid.ts` | Add slip verification call before sending confirmation to creator |
| `src/actions/confirmPayment.ts` | Show verification result in creator's confirmation DM |
| `src/config.ts` | Add new env vars for slip verification |
| `src/database/schema.ts` | Add `promptpay_ids` table |
| `src/database/migrate.ts` | Add migration for new table |
| `.env.example` | Add new env vars |

### Database Schema Changes

**New table: `promptpay_ids`**

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | UUID |
| user_id | TEXT (UNIQUE) | Slack user ID |
| promptpay_type | TEXT | "phone", "national_id", or "ewallet" |
| promptpay_id | TEXT | The PromptPay ID value |
| created_at | DATETIME | Timestamp |
| updated_at | DATETIME | Timestamp |

### New Environment Variables

```env
# Phase 5: Payment Integration
SLIP_VERIFY_PROVIDER=none          # "none" (default), "openslipverify", or "easyslip"
SLIP_VERIFY_API_KEY=               # API key for slip verification provider (if applicable)
SLIP_VERIFY_API_URL=               # Custom API URL (optional, uses provider defaults)
```

### Key Code Examples

**PromptPay QR generation (`src/services/promptPayQr.ts`):**
```typescript
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

export async function generatePromptPayQr(
  promptPayId: string,
  amount: number
): Promise<Buffer> {
  // Generate PromptPay payload string (EMVCo format)
  const payload = generatePayload(promptPayId, { amount });

  // Render to PNG buffer
  const qrBuffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  return qrBuffer;
}
```

**Slip verification (`src/services/slipVerify.ts`):**
```typescript
export interface SlipVerifyResult {
  verified: boolean;
  amount?: number;
  senderBank?: string;
  senderAccount?: string;
  receiverBank?: string;
  receiverAccount?: string;
  transactionDate?: string;
  referenceNo?: string;
  errorMessage?: string;
}

export async function verifySlip(
  slipImageOrRef: string
): Promise<SlipVerifyResult> {
  // Calls configured provider API
  // Returns verification result
}
```

---

## Bill Card Design (Updated)

### Active State — With PromptPay

```
┌──────────────────────────────────────┐
│  Taxi to Airport            ฿400    │
│  Created by @Sea_Talay              │
│  Split equally (4 people)           │
│─────────────────────────────────────│
│  ✅ @Sea_Talay 👑    ฿100    Paid  │
│  🔴 @Alice           ฿100  Unpaid  │
│  🔴 @Bob             ฿100  Unpaid  │
│  ⏳ @Charlie          ฿100 Pending │
│─────────────────────────────────────│
│  Collected: ฿100 / ฿400            │
│  ██████░░░░░░░░░░░░░░  25%         │
│─────────────────────────────────────│
│  [Pay via PromptPay] [Mark as Paid] │
│  [Manage Bill]                      │
└──────────────────────────────────────┘
```

### Creator Confirmation DM — With Slip Verification

```
┌──────────────────────────────────────────┐
│  💰 Payment Notification                │
│                                          │
│  @Alice says they paid ฿100             │
│  for "Taxi to Airport"                   │
│                                          │
│  [Slip Image]                            │
│                                          │
│  ✅ Slip Verified                        │
│  Amount: ฿100.00                         │
│  From: KBank (xxx-x-x1234-x)            │
│  To: SCB (xxx-x-x5678-x)                │
│  Date: 7 Feb 2026, 14:32                │
│  Ref: 2026020712345678                   │
│                                          │
│  [Confirm Payment]  [Reject]             │
└──────────────────────────────────────────┘
```

---

## Implementation Phases (Sub-steps)

### Phase 5a: PromptPay QR Generation (Core)

- [ ] Add `promptpay-qr` and `qrcode` dependencies
- [ ] Create `promptpay_ids` table and migration
- [ ] Create `models/promptPayId.ts` — CRUD for PromptPay IDs
- [ ] Create `commands/promptpay.ts` — `/<command> promptpay` command handler
- [ ] Create `views/promptPayModal.ts` — Modal for saving/updating PromptPay ID
- [ ] Create `services/promptPayQr.ts` — QR code generation service
- [ ] Create `actions/payViaPromptPay.ts` — "Pay via PromptPay" button handler
- [ ] Create `views/promptPayQrMessage.ts` — Ephemeral message with QR image
- [ ] Update `views/billCard.ts` — Add "Pay via PromptPay" button (conditional)
- [ ] Update `app.ts` — Register new command and action handlers
- [ ] Update `config.ts` and `.env.example` — Add new env vars
- [ ] Update `database/schema.ts` — Add new table

### Phase 5b: Slip Verification (Optional Enhancement)

- [ ] Create `services/slipVerify.ts` — Slip verification API wrapper
- [ ] Update `actions/markPaid.ts` — Call slip verification after slip upload
- [ ] Update `actions/confirmPayment.ts` — Show verification result in creator DM
- [ ] Support multiple providers: OpenSlipVerify, EasySlip, or none
- [ ] Handle verification failures gracefully (fall back to manual confirmation)

### Phase 5c: Polish & Documentation

- [ ] Update `plan/PLAN.md` with Phase 5 completion status
- [ ] Update `README.md` with PromptPay feature documentation
- [ ] Update `plan/SETUP_GUIDE.md` with new setup steps
- [ ] Add help text for `/<command> promptpay` command
- [ ] Privacy: ensure PromptPay ID is not exposed in plain text to participants

---

## Privacy & Security Considerations

1. **PromptPay ID exposure** — The QR code inherently contains the PromptPay ID. This is by design (same as showing a QR code at a shop). However, the raw ID should not be displayed as text in messages — only the QR image.
2. **Slip verification API keys** — Stored in environment variables, never committed to source.
3. **PromptPay ID storage** — Stored in the database. Consider encryption at rest for production deployments.
4. **User consent** — The creator explicitly opts in by saving their PromptPay ID. They can remove it at any time.

---

## References

- [promptpay-qr (npm)](https://www.npmjs.com/package/promptpay-qr) — QR code payload generator
- [promptpay-qr (GitHub)](https://github.com/dtinth/promptpay-qr) — Source and documentation
- [PromptPay — Bank of Thailand](https://www.bot.or.th/en/financial-innovation/digital-finance/digital-payment/promptpay.html) — Official PromptPay info
- [OpenSlipVerify](https://openslipverify.com/) — Free slip verification API
- [EasySlip](https://developer.easyslip.com/) — Slip verification and bill payment API
- [KBank Slip Verification API](https://apiportal.kasikornbank.com/product/public/All/Slip%20Verification/Documentation) — KBank's official slip API
