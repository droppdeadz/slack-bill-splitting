# Slack Bill Splitting - Implementation Plan

> Inspired by KBANK's Khunthong (ขุนทอง) — a popular LINE chatbot for group expense splitting.

## Overview

Slack Bill Splitting is a Slack bot focused on bill splitting and payment tracking. Create bills, split expenses among group members, track who has paid, and send reminders — all within Slack channels and DMs.

---

## Core Features

### 1. Create a Bill (`/<command> create`)
- Creator specifies: **bill name**, **split type**, **participants** (mention @users)
- **Equal split:** Creator enters a total amount — split evenly among all participants. Bill goes straight to payment tracking.
- **Item-based split:** Creator enters a list of items with costs (e.g., "Pad Thai ฿120", "Som Tum ฿80"). Total is calculated automatically from items. Participants then self-select which items they owe for.
- Posts an interactive bill card in the channel

### 2. Item Selection (Item-based split only)
- After bill creation, the bot **DMs each participant** to select which items they owe for
- Each participant picks their items from the list via an interactive message
- Shared items can be selected by multiple participants (cost split among them)
- Bill card in channel updates as participants complete their selections

### 3. Finalize Calculation (Item-based split only)
- Once **all participants** have selected their items, the creator is notified
- Creator clicks **Finalize Shares** to fix each person's share
- Shares are computed from selected items; items nobody selected and rounding remainders go to the creator's share, so shares always sum to the bill total
- Bill moves into payment tracking phase

### 4. Bill Card (Interactive Message)
- **Equal split:** Goes directly to active payment tracking state
- **Item-based — awaiting selection:** Shows items list, participant selection progress
- **Item-based — active (payment tracking):** Shows each participant with their calculated amount and payment status
- Buttons change based on state: `Manage Bill` opens a creator-only modal with `Remind All` and `Cancel Bill`
- Payment phase buttons: `Mark as Paid`, `Manage Bill`

### 5. Mark as Paid
- Participant clicks `Mark as Paid` on the bill card
- A modal opens where the participant can **optionally upload a payment slip** (screenshot/photo)
- The upload is optional — participants who paid with cash can skip it
- Creator receives a notification (with the slip image if provided) to **confirm** or **reject** the payment
- Once confirmed, the bill card updates in real-time

### 6. Payment Reminders
- Creator can click `Remind All` to send DM reminders to unpaid participants
- Automatic reminders can be scheduled (e.g., daily at 9 AM for outstanding bills)
- Participants get a DM with a summary of all their unpaid bills

### 7. Bill Summary (`/<command> list`)
- Shows all active bills in the current channel
- Filter by: `created by me`, `owed by me`, `all`

### 8. My Outstanding Bills (`/<command> me`)
- DM the user a summary of all bills they owe across all channels

### 9. Bill History (`/<command> history`)
- View completed/cancelled bills

---

## User Flows

### Flow 1a: Creating a Bill (Equal Split — Manual Entry)
```
User types: /<command> create
  -> Modal opens: "How would you like to create this bill?"
     - User selects: "Enter Manually"
  -> Form shows (all required):
     - Bill name (e.g., "Taxi to airport")
     - Split type: Equal
     - Total amount (e.g., 400)
     - Participants: Select @users
  -> Bot posts bill card in channel (status: active)
  -> Each participant owes total / number of participants
  -> Directly enters payment tracking phase
```

### Flow 1b: Creating a Bill (Item-based Split — Manual Entry)
```
User types: /<command> create
  -> Modal opens: "How would you like to create this bill?"
     - User selects: "Enter Manually"
  -> Form shows (all required):
     - Bill name (e.g., "Lunch at Sushi place")
     - Split type: Item-based
     - Items with costs (e.g., "Salmon Sushi ฿350", "Ramen ฿280", ...)
     - Participants: Select @users
  -> Bot posts bill card in channel (status: awaiting_selection)
  -> Bot DMs each participant to select their items
```

### Flow 1c: Creating a Bill (Upload Receipt Image)
```
User types: /<command> create
  -> Modal opens: "How would you like to create this bill?"
     - User selects: "Upload Receipt Image"
  -> Form shows:
     - Receipt Image (required)
     - Bill Name (optional)
     - Participants (optional)
  -> User clicks "Scan Receipt"
  -> OCR processes image → Review modal opens with pre-filled items
  -> User reviews/edits and clicks "Create Bill"
```

### Flow 2: Selecting Items (Item-based split only)
```
Participant receives DM from bot:
  "You've been added to 'Lunch at Sushi place' by @creator.
   Select the items you owe for:"
  -> Interactive checklist of all bill items with costs
  -> Participant selects their items and submits
  -> Bill card in channel updates selection progress (e.g., "2/4 selected")
  -> Once all participants have selected -> Creator is notified
```

### Flow 3: Finalizing the Bill (Creator)
```
Creator receives notification:
  "All participants have selected their items for 'Lunch at Sushi place'."
  (warns which items nobody selected — they will be added to the creator's share)
  -> Creator clicks "Finalize Shares"
  -> Shares are computed from selected items (unselected items + rounding -> creator)
  -> Bill card updates to show each person's owed amount
  -> Bill moves to active payment tracking (status: active)
```

### Flow 4: Paying a Bill
```
Participant sees bill card in channel (active status)
  -> Clicks "Mark as Paid"
  -> Modal opens: optionally upload a payment slip (photo/screenshot)
  -> Participant submits (with or without slip)
  -> Creator gets DM: "@user says they paid ฿330 for 'Lunch'. Confirm?"
     (includes payment slip image if uploaded)
  -> Creator clicks "Confirm"
  -> Bill card updates: user shows as Paid with checkmark
  -> If all paid -> Bill marked as "Completed"
```

### Flow 5: Sending Reminders
```
Creator clicks "Remind All" on bill card
  -> Bot sends DM to each unpaid participant:
     "Reminder: You owe ฿330 for 'Lunch at Sushi place'
      created by @creator. [View Bill] [Mark as Paid]"
```

---

## Tech Stack

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Runtime        | Node.js (v20+)                    |
| Framework      | Bolt for Slack ([@slack/bolt](https://slack.dev/bolt-js)) |
| Language       | TypeScript                        |
| Database       | SQLite (via better-sqlite3) for simplicity, easily swappable to PostgreSQL |
| Scheduler      | node-cron (for automatic reminders) |
| OCR            | tesseract.js (local receipt scanning, no API key needed) |
| QR Code        | promptpay-qr + qrcode (PromptPay QR generation)  |
| Slip Verify    | Manual (creator confirms/rejects uploaded slips)  |
| Package Manager| pnpm                              |

---

## Project Structure

```
slack-bill-splitting/
├── plan/PLAN.md
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── app.ts                  # Bolt app entry point & command router
│   ├── config.ts               # Environment config
│   ├── database/
│   │   ├── schema.ts           # DB schema & table creation
│   │   ├── connection.ts       # DB connection
│   │   └── migrate.ts          # Database migration runner
│   ├── models/
│   │   ├── bill.ts             # Bill CRUD operations
│   │   ├── billItem.ts         # Bill item CRUD operations
│   │   ├── participant.ts      # Participant CRUD operations
│   │   ├── itemSelection.ts    # Item selection CRUD operations
│   │   ├── paymentMethod.ts    # Payment method CRUD (PromptPay + bank account)
│   │   └── billFile.ts         # Bill file tracking for auto-cleanup
│   ├── commands/
│   │   ├── create.ts           # /<command> create — modal, submission & bill creation
│   │   ├── list.ts             # /<command> list
│   │   ├── me.ts               # /<command> me
│   │   ├── history.ts          # /<command> history
│   │   └── payment.ts          # /<command> payment — payment method setup
│   ├── actions/
│   │   ├── markPaid.ts         # "Mark as Paid" button + modal submission
│   │   ├── confirmPayment.ts   # Creator confirms/rejects payment
│   │   ├── selectItems.ts      # Participant selects items via DM
│   │   ├── finalizeShares.ts   # Creator finalizes shares (Finalize Shares)
│   │   ├── manageBill.ts       # "Manage Bill" button → creator-only modal
│   │   ├── remindAll.ts        # "Remind All" action handler (from modal)
│   │   ├── cancelBill.ts       # "Cancel Bill" action handler (from modal)
│   │   ├── viewDetails.ts      # "View Details" button handler
│   │   └── paymentInfo.ts      # "Pay via PromptPay" & "Payment Info" button handlers
│   ├── views/
│   │   ├── createBillModal.ts  # Modal form for creating bill (items + participants)
│   │   ├── markPaidModal.ts    # Modal for marking as paid with optional slip upload
│   │   ├── billCard.ts         # Bill card Block Kit message (awaiting selection/active states)
│   │   ├── itemSelectMessage.ts # DM item selection checklist for participants
│   │   ├── reminderMessage.ts  # DM reminder message
│   │   ├── resultModal.ts      # Shared result modal for manage bill actions
│   │   ├── paymentModal.ts     # Modal for setting up payment methods
│   │   └── paymentInfoMessage.ts # Ephemeral messages for PromptPay QR & bank info
│   ├── services/
│   │   ├── receiptOcr.ts       # tesseract.js OCR wrapper for receipt images
│   │   ├── receiptParser.ts    # Regex parser: raw OCR text → structured receipt data
│   │   ├── promptPayQr.ts      # PromptPay QR code generation (PNG buffer)
│   │   └── (slip verification removed — manual confirm/reject only)
│   ├── scheduler/
│   │   ├── reminders.ts        # Cron job for auto-reminders
│   │   └── fileCleanup.ts      # Cron job for auto-deleting uploaded files
│   └── utils/
│       ├── formatCurrency.ts   # Format amounts (e.g., ฿1,320)
│       └── splitCalculator.ts  # Calculate equal splits & per-person amounts from item selections
└── data/
    └── bills.db                # SQLite database file
```

---

## Database Schema

### `bills` table
| Column       | Type      | Description                       |
|--------------|-----------|-----------------------------------|
| id           | TEXT (PK) | UUID                              |
| name         | TEXT      | Bill name                         |
| total_amount | REAL      | Total bill amount                 |
| currency     | TEXT      | Currency code (default: THB)      |
| split_type   | TEXT      | "equal" or "item"                 |
| creator_id   | TEXT      | Slack user ID of creator          |
| channel_id   | TEXT      | Slack channel where bill was posted |
| message_ts   | TEXT      | Slack message timestamp (for updating) |
| status       | TEXT      | "awaiting_selection" (item-based only), "active" (payment tracking), "completed", "cancelled" |
| created_at   | DATETIME  | Timestamp                         |
| updated_at   | DATETIME  | Timestamp                         |

### `bill_items` table
| Column     | Type      | Description                    |
|------------|-----------|--------------------------------|
| id         | TEXT (PK) | UUID                           |
| bill_id    | TEXT (FK) | Reference to bill              |
| name       | TEXT      | Item name (e.g., "Salmon Sushi") |
| amount     | REAL      | Item cost                      |
| created_at | DATETIME  | Timestamp                      |

### `participants` table
| Column          | Type      | Description                    |
|-----------------|-----------|--------------------------------|
| id              | TEXT (PK) | UUID                           |
| bill_id         | TEXT (FK) | Reference to bill              |
| user_id         | TEXT      | Slack user ID                  |
| amount          | REAL      | Calculated amount owed (set after finalization) |
| has_selected    | BOOLEAN   | Whether participant has completed item selection |
| status          | TEXT      | "unpaid", "awaiting_confirmation", "paid" |
| paid_at         | DATETIME  | When payment was confirmed     |
| created_at      | DATETIME  | Timestamp                      |

### `item_selections` table
| Column         | Type      | Description                    |
|----------------|-----------|--------------------------------|
| id             | TEXT (PK) | UUID                           |
| bill_item_id   | TEXT (FK) | Reference to bill_items        |
| participant_id | TEXT (FK) | Reference to participants      |
| created_at     | DATETIME  | Timestamp                      |

### `payment_methods` table
| Column              | Type      | Description                                 |
|---------------------|-----------|---------------------------------------------|
| id                  | TEXT (PK) | UUID                                        |
| user_id             | TEXT (UQ) | Slack user ID (one row per user)            |
| promptpay_type      | TEXT      | "phone", "national_id", "ewallet", or null  |
| promptpay_id        | TEXT      | PromptPay ID (null if no PromptPay)         |
| bank_name           | TEXT      | e.g., "KBank" (null if no bank account)     |
| bank_account_number | TEXT      | Account number (null if no bank account)    |
| bank_account_name   | TEXT      | Account holder name (null if no bank)       |
| created_at          | DATETIME  | Timestamp                                   |
| updated_at          | DATETIME  | Timestamp                                   |

### `bill_files` table
| Column        | Type      | Description                                         |
|---------------|-----------|-----------------------------------------------------|
| id            | TEXT (PK) | UUID                                                |
| bill_id       | TEXT (FK) | Reference to bill                                   |
| slack_file_id | TEXT      | Slack file ID for API calls                         |
| file_type     | TEXT      | "payment_slip", "receipt_image", or "promptpay_qr"  |
| uploaded_by   | TEXT      | Slack user ID or "bot"                              |
| created_at    | DATETIME  | Timestamp                                           |
| deleted_at    | DATETIME  | NULL until deleted/handled by cleanup               |

> **Calculation:** All math is in integer satang. When the creator finalizes shares, each item's cost is divided equally among all participants who selected it, rounded down. Items nobody selected and every rounding remainder are added to the creator's share, so the shares of all participants always add up exactly to the bill total. Equal splits follow the same rule (non-creators rounded down, remainder to the creator).

---

## Slack App Configuration

### Required Scopes (Bot Token)
- `commands` - Slash commands
- `chat:write` - Send and update messages
- `im:write` - Send DMs for reminders
- `users:read` - Get user display names
- `files:read` - Read uploaded payment slips and receipt images
- `files:write` - Upload PromptPay QR code images

### Slash Command
- Configurable via `SLASH_COMMAND` env var (default: `slack-bill-splitting`) — must match the command created at https://api.slack.com/apps

### Interactivity
- Enable **Interactivity & Shortcuts**
- Request URL: `https://<your-domain>/slack/events`

### Event Subscriptions (optional, for future)
- `app_mention` - Allow `@bot` mentions as alternative to slash commands

---

## Implementation Phases

### Phase 1: Foundation (MVP) — COMPLETED
- [x] Project setup (TypeScript, Bolt, SQLite)
- [x] `/<command> create` command with modal
- [x] Bill card with Block Kit (posted to channel)
- [x] Equal split calculation
- [x] `Mark as Paid` button + creator confirmation flow
- [x] Bill card real-time updates

### Phase 2: Management — COMPLETED
- [x] `/<command> list` - View active bills in channel
- [x] `/<command> me` - View my outstanding bills
- [x] `/<command> history` - View past bills
- [x] `Cancel Bill` functionality (creator only)

### Phase 3: Item-based Splitting & Polish — COMPLETED
- [x] `Remind All` button - manual reminders via DM
- [x] Automatic daily reminders (node-cron)
- [x] Bill summary when all participants have paid (auto-completes bill)
- [x] `/<command> list` filters — *`/<command> list all` (default), `/<command> list mine` (bills I created), `/<command> list owed` (bills I owe on). Filter hint shown in response.*
- [x] `/<command> me` as true DM — *Opens a DM conversation with the user and posts the outstanding bills summary there. Shows brief ephemeral confirmation in the original channel.*
- [x] Item-based bill creation — *Add "Item-based" as a split type alongside "Equal". When selected, creator enters bill name, list of items with costs, and selects participants. Total is calculated from items automatically. Replaces the old "Custom Amounts" per-person input.*
- [x] Participant item selection via DM — *After bill creation, bot DMs each participant with an interactive checklist of items. Participant selects which items they owe for. Shared items (selected by multiple people) have their cost split equally among selectors. Bill card updates selection progress.*
- [x] Creator finalizes shares — *Once all participants have selected items, creator is notified and clicks "Finalize Shares". Shares are computed and the bill moves to active payment tracking.*
- [x] Bill status lifecycle — *Statuses: "awaiting_selection" (waiting for item selections, item-based only), "active" (payment tracking), "completed", "cancelled". Bill card UI adapts to current status.*

### Phase 3.5: Creator Auto-Pay — COMPLETED
- [x] Auto-include bill creator as participant — *Creator is always added to the participants list even if not explicitly selected*
- [x] Auto-mark creator as paid on equal split — *The creator is automatically marked as "Paid" since they paid the bill upfront and collect from others*
- [x] Auto-mark creator as paid after item-based calculation — *After "Finalize Shares", the creator's share is auto-marked as paid*
- [x] Block "Mark as Paid" for creator — *If the creator clicks "Mark as Paid", they see a message that they don't need to pay*
- [x] Auto-complete bill if creator is only participant — *Edge case: if no other participants, bill completes immediately*

### Phase 4: Bill Image Recognition — COMPLETED
> Automatically read bills from uploaded images and pre-fill the create bill form. Uses tesseract.js for free, local OCR — no API keys or external services needed.
- [x] Receipt/bill image upload in create modal — *Entry method selector (radio buttons): "Enter Manually" or "Upload Receipt Image". Manual mode shows all fields as required. Upload mode shows receipt image (required), bill name (optional), and participants (optional).*
- [x] OCR service — *New `receiptOcr.ts` using tesseract.js to extract raw text from receipt images (English + Thai)*
- [x] Receipt text parser — *New `receiptParser.ts` to parse raw OCR text into structured data (store name, items with amounts, total) using regex*
- [x] Auto-fill bill form from parsed data — *On submission with image: process → open new pre-filled review modal → user reviews/edits → submits into existing flow*
- [x] Optimized image upload flow — *When uploading a receipt, all other fields (bill name, items/total, participants) are optional. User data entered alongside the image (participants, bill name) carries forward to the review modal. User-entered bill name takes priority over OCR store name.*

### Phase 5: Payment Integration — COMPLETED
> Payment method management, PromptPay QR generation, bank account info display, and slip verification via OpenSlipVerify.
- [x] `/<command> payment` command — *Modal to save PromptPay (type + ID) and/or bank account (bank, account number, holder name). Single row per user, both methods optional. Pre-fills on re-open.*
- [x] Bill card payment buttons — *Active bill cards conditionally show "Pay via PromptPay" (if creator has PromptPay) and/or "Payment Info" (if creator has bank account) before the existing "Mark as Paid" and "Manage Bill" buttons.*
- [x] PromptPay QR generation — *Clicking "Pay via PromptPay" generates a QR code (via promptpay-qr + qrcode) with the participant's amount, uploads it to Slack, and shows it as an ephemeral message.*
- [x] Bank account info display — *Clicking "Payment Info" shows bank name, masked account number (last 4 digits), and holder name as an ephemeral message.*
- [x] ~~Slip verification via OpenSlipVerify~~ — *Removed. OpenSlipVerify no longer provides services. Payment slips are now verified manually by the bill creator (confirm/reject flow).*
- [x] Edge case handling — *Creator can't click their own payment buttons. Non-participants get an error. Already-paid participants get a notification.*

### Phase 6: File Cleanup — COMPLETED
> Automatically delete uploaded files (payment slips, receipt images, PromptPay QR codes) 7 days after the associated bill is completed or cancelled, reducing workspace file clutter.
- [x] `bill_files` tracking table — *Tracks all Slack file IDs associated with bills (payment slips, receipt images, PromptPay QR codes) with file type and uploader info.*
- [x] File tracking at upload points — *Payment slips (markPaid), receipt images (create via upload), and PromptPay QR codes (paymentInfo) are tracked in the `bill_files` table on upload.*
- [x] Scheduled file cleanup — *Daily cron job (default: 3 AM) queries files on completed/cancelled bills older than 7 days, deletes bot-uploaded files (QR codes) via `files.delete`, and gracefully handles user-owned files (payment slips, receipt images) that the bot can't delete.*
- [x] `FILE_CLEANUP_CRON` config — *Configurable cron schedule for file cleanup (default: `0 3 * * *`).*

### Phase 7: Domain Model Alignment — COMPLETED
> Align code with the vocabulary in [GLOSSARY.md](../GLOSSARY.md): shares always sum to the bill total, and no overloaded status names.
- [x] Unselected items go to the creator — *Items nobody selected are added to the creator's share and shown on the bill card as "Unselected". The creator is warned in the "all selected" DM and again after finalizing.*
- [x] Rounding remainder goes to the creator — *Share math is done in satang. Non-creator shares are rounded down; the remainder goes to the creator (equal and item-based splits). Item breakdowns are computed by the same function as the shares.*
- [x] Service charge / VAT kept as items — *Receipt parser keeps service charge and VAT lines as items, unless the receipt total shows they were already included in item prices. Discount lines are still skipped.*
- [x] Renamed statuses — *Bill "pending" → "awaiting_selection"; participant "pending" → "awaiting_confirmation" (migration 004 rewrites existing rows).*
- [x] "Complete Calculation" → "Finalize Shares" — *Button label, action_id (`finalize_shares`; legacy `complete_calculation` still handled for old cards) and file (`actions/finalizeShares.ts`).*
- [x] User-facing "bill owner" wording replaced with "creator".

---

## Bill Card Design (Block Kit)

### Equal Split (Active)
```
┌──────────────────────────────────────┐
│  Taxi to Airport            ฿400    │
│  Created by @Sea_Talay              │
│  Split equally (4 people)           │
│─────────────────────────────────────│
│  @Danit          ฿100        Paid   │
│  @Grace          ฿100      Unpaid   │
│  @Kong           ฿100      Unpaid   │
│  @Nut            ฿100      Unpaid   │
│─────────────────────────────────────│
│  Collected: ฿100 / ฿400            │
│  ██████░░░░░░░░░░░░░░  25%         │
│─────────────────────────────────────│
│  [Mark as Paid] [Manage Bill]       │
└──────────────────────────────────────┘
```

### Item-based — Awaiting Selection State
```
┌──────────────────────────────────────┐
│  Lunch at Sushi Place       ฿1,320  │
│  Created by @Sea_Talay              │
│  4 items · 4 participants           │
│─────────────────────────────────────│
│  Items:                             │
│    Salmon Sushi         ฿350        │
│    Ramen                ฿280        │
│    Gyoza                ฿340        │
│    Green Tea x4         ฿350        │
│─────────────────────────────────────│
│  Selection: 2/4 completed           │
│  ██████████░░░░░░░░░░  50%         │
│  ✓ @Danit  ✓ @Grace                │
│  ⏳ @Kong   ⏳ @Nut                  │
│─────────────────────────────────────│
│  [Manage Bill]                      │
└──────────────────────────────────────┘
```

### Item-based — Active Payment State (Khunthong-inspired)

> Inspired by KBANK Khunthong: each participant shows their total with a per-item
> breakdown underneath. Creator marked with 👑. Payment status shown per person.

```
┌──────────────────────────────────────────┐
│  Lunch at Sushi Place            ฿1,320  │
│  Created by @Sea_Talay                   │
│  Item-based split (4 people)             │
│──────────────────────────────────────────│
│                                          │
│  ✅ @Danit 👑              ฿455    Paid  │
│     Salmon Sushi ฿175  ·  Ramen ฿280    │
│                                          │
│  🔴 @Grace                ฿280  Unpaid   │
│     Ramen ฿280                           │
│                                          │
│  🔴 @Kong              ฿232.50  Unpaid   │
│     Gyoza ฿170  ·  Green Tea ฿62.50     │
│                                          │
│  🔴 @Nut               ฿352.50  Unpaid   │
│     Salmon Sushi ฿175  ·  Gyoza ฿170    │
│     Green Tea ฿7.50                      │
│                                          │
│──────────────────────────────────────────│
│  Collected: ฿455 / ฿1,320               │
│  ████████░░░░░░░░░░░░  34%              │
│──────────────────────────────────────────│
│  [Mark as Paid] [Manage Bill]            │
└──────────────────────────────────────────┘
```

---

## Environment Variables

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...    # For Socket Mode (dev)
PORT=3000
DATABASE_PATH=./data/bills.db
DEFAULT_CURRENCY=THB
REMINDER_CRON=0 9 * * *    # Daily at 9 AM
FILE_CLEANUP_CRON=0 3 * * *  # Daily at 3 AM — auto-delete files from completed bills
SLASH_COMMAND=slack-bill-splitting  # Must match command name in Slack app config
```

---

## Getting Started (Development)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in Slack credentials
cp .env.example .env

# 3. Create Slack App at https://api.slack.com/apps
#    - Enable Socket Mode for local dev
#    - Add slash command (e.g. /split)
#    - Enable Interactivity
#    - Add required bot scopes
#    - Install to workspace

# 4. Run in development
pnpm dev

# 5. Test in Slack
#    Type: /<command> create
```

---

## Key Design Decisions

1. **SQLite for MVP** - Zero setup, single file DB. Can migrate to PostgreSQL for production.
2. **Socket Mode for dev** - No need for ngrok/public URL during development.
3. **Creator confirms payments** - Since this is not connected to real banking, the bill creator acts as the "source of truth" for payment verification.
6. **Creator auto-paid** - The bill creator is always included as a participant and auto-marked as paid. They paid the bill upfront and collect from others — no need to pay themselves.
4. **Channel-scoped bills** - Bills are tied to channels for context, but users can see all their bills via `/<command> me`.
5. **Block Kit for rich UI** - Slack's Block Kit provides interactive buttons, modals, and rich formatting for a smooth in-Slack experience.
