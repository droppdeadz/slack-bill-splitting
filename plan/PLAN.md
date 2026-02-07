# Copter for Slack - Implementation Plan

> Inspired by KBANK's Khunthong (ขุนทอง) — a popular LINE chatbot for group expense splitting.

## Overview

Copter is a Slack bot focused on bill splitting and payment tracking. Create bills, split expenses among group members, track who has paid, and send reminders — all within Slack channels and DMs.

---

## Core Features

### 1. Create a Bill (`/copter create`)
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
- Creator clicks **Complete Calculation** to finalize each person's total
- Per-person amounts are computed from their selected items
- Bill moves into payment tracking phase

### 4. Bill Card (Interactive Message)
- **Equal split:** Goes directly to active payment tracking state
- **Item-based — pending selection:** Shows items list, participant selection progress
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

### 7. Bill Summary (`/copter list`)
- Shows all active bills in the current channel
- Filter by: `created by me`, `owed by me`, `all`

### 8. My Outstanding Bills (`/copter me`)
- DM the user a summary of all bills they owe across all channels

### 9. Bill History (`/copter history`)
- View completed/cancelled bills

---

## User Flows

### Flow 1a: Creating a Bill (Equal Split — Manual Entry)
```
User types: /copter create
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
User types: /copter create
  -> Modal opens: "How would you like to create this bill?"
     - User selects: "Enter Manually"
  -> Form shows (all required):
     - Bill name (e.g., "Lunch at Sushi place")
     - Split type: Item-based
     - Items with costs (e.g., "Salmon Sushi ฿350", "Ramen ฿280", ...)
     - Participants: Select @users
  -> Bot posts bill card in channel (status: pending selection)
  -> Bot DMs each participant to select their items
```

### Flow 1c: Creating a Bill (Upload Receipt Image)
```
User types: /copter create
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
  -> Creator clicks "Complete Calculation"
  -> Per-person amounts are computed from selected items
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
| Package Manager| pnpm                              |

---

## Project Structure

```
copter/
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
│   │   └── itemSelection.ts    # Item selection CRUD operations
│   ├── commands/
│   │   ├── create.ts           # /copter create — modal, submission & bill creation
│   │   ├── list.ts             # /copter list
│   │   ├── me.ts               # /copter me
│   │   └── history.ts          # /copter history
│   ├── actions/
│   │   ├── markPaid.ts         # "Mark as Paid" button + modal submission handler
│   │   ├── confirmPayment.ts   # Creator confirms/rejects payment
│   │   ├── selectItems.ts      # Participant selects items via DM
│   │   ├── completeCalc.ts     # Creator finalizes bill calculation
│   │   ├── manageBill.ts       # "Manage Bill" button → creator-only modal
│   │   ├── remindAll.ts        # "Remind All" action handler (from modal)
│   │   ├── cancelBill.ts       # "Cancel Bill" action handler (from modal)
│   │   └── viewDetails.ts      # "View Details" button handler
│   ├── views/
│   │   ├── createBillModal.ts  # Modal form for creating bill (items + participants)
│   │   ├── markPaidModal.ts    # Modal for marking as paid with optional slip upload
│   │   ├── billCard.ts         # Bill card Block Kit message (pending/active states)
│   │   ├── itemSelectMessage.ts # DM item selection checklist for participants
│   │   ├── reminderMessage.ts  # DM reminder message
│   │   └── resultModal.ts      # Shared result modal for manage bill actions
│   ├── services/
│   │   ├── receiptOcr.ts       # tesseract.js OCR wrapper for receipt images
│   │   └── receiptParser.ts    # Regex parser: raw OCR text → structured receipt data
│   ├── scheduler/
│   │   └── reminders.ts        # Cron job for auto-reminders
│   └── utils/
│       ├── formatCurrency.ts   # Format amounts (e.g., ฿1,320)
│       └── splitCalculator.ts  # Calculate equal splits & per-person amounts from item selections
└── data/
    └── copter.db               # SQLite database file
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
| status       | TEXT      | "pending" (item selection, item-based only), "active" (payment tracking), "completed", "cancelled" |
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
| status          | TEXT      | "unpaid", "pending", "paid"    |
| paid_at         | DATETIME  | When payment was confirmed     |
| created_at      | DATETIME  | Timestamp                      |

### `item_selections` table
| Column         | Type      | Description                    |
|----------------|-----------|--------------------------------|
| id             | TEXT (PK) | UUID                           |
| bill_item_id   | TEXT (FK) | Reference to bill_items        |
| participant_id | TEXT (FK) | Reference to participants      |
| created_at     | DATETIME  | Timestamp                      |

> **Calculation:** When the creator finalizes, each item's cost is divided equally among all participants who selected it. A participant's total is the sum of their shares across all selected items.

---

## Slack App Configuration

### Required Scopes (Bot Token)
- `commands` - Slash commands
- `chat:write` - Send and update messages
- `im:write` - Send DMs for reminders
- `users:read` - Get user display names
- `files:read` - Read uploaded payment slips

### Slash Command
- Configurable via `SLASH_COMMAND` env var (default: `slack-bill-splitting`) — must match the command created at https://api.slack.com/apps

### Interactivity
- Enable **Interactivity & Shortcuts**
- Request URL: `https://<your-domain>/slack/events`

### Event Subscriptions (optional, for future)
- `app_mention` - Allow `@copter` mentions as alternative to slash commands

---

## Implementation Phases

### Phase 1: Foundation (MVP) — COMPLETED
- [x] Project setup (TypeScript, Bolt, SQLite)
- [x] `/copter create` command with modal
- [x] Bill card with Block Kit (posted to channel)
- [x] Equal split calculation
- [x] `Mark as Paid` button + creator confirmation flow
- [x] Bill card real-time updates

### Phase 2: Management — COMPLETED
- [x] `/copter list` - View active bills in channel
- [x] `/copter me` - View my outstanding bills
- [x] `/copter history` - View past bills
- [x] `Cancel Bill` functionality (creator only)

### Phase 3: Item-based Splitting & Polish — COMPLETED
- [x] `Remind All` button - manual reminders via DM
- [x] Automatic daily reminders (node-cron)
- [x] Bill summary when all participants have paid (auto-completes bill)
- [x] `/copter list` filters — *`/copter list all` (default), `/copter list mine` (bills I created), `/copter list owed` (bills I owe on). Filter hint shown in response.*
- [x] `/copter me` as true DM — *Opens a DM conversation with the user and posts the outstanding bills summary there. Shows brief ephemeral confirmation in the original channel.*
- [x] Item-based bill creation — *Add "Item-based" as a split type alongside "Equal". When selected, creator enters bill name, list of items with costs, and selects participants. Total is calculated from items automatically. Replaces the old "Custom Amounts" per-person input.*
- [x] Participant item selection via DM — *After bill creation, bot DMs each participant with an interactive checklist of items. Participant selects which items they owe for. Shared items (selected by multiple people) have their cost split equally among selectors. Bill card updates selection progress.*
- [x] Creator finalizes calculation — *Once all participants have selected items, creator is notified and clicks "Complete Calculation". Per-person amounts are computed and the bill moves to active payment tracking.*
- [x] Bill status lifecycle — *Statuses: "pending" (waiting for item selections, item-based only), "active" (payment tracking), "completed", "cancelled". Bill card UI adapts to current status.*

### Phase 3.5: Bill Owner Auto-Pay — COMPLETED
- [x] Auto-include bill creator as participant — *Creator is always added to the participants list even if not explicitly selected*
- [x] Auto-mark creator as paid on equal split — *Bill owner is automatically marked as "Paid" since they paid the bill upfront and collect from others*
- [x] Auto-mark creator as paid after item-based calculation — *After "Complete Calculation", the creator's share is auto-marked as paid*
- [x] Block "Mark as Paid" for bill owner — *If the bill owner clicks "Mark as Paid", they see a message that they don't need to pay*
- [x] Auto-complete bill if creator is only participant — *Edge case: if no other participants, bill completes immediately*

### Phase 4: Bill Image Recognition — COMPLETED
> Automatically read bills from uploaded images and pre-fill the create bill form. Uses tesseract.js for free, local OCR — no API keys or external services needed.
- [x] Receipt/bill image upload in create modal — *Entry method selector (radio buttons): "Enter Manually" or "Upload Receipt Image". Manual mode shows all fields as required. Upload mode shows receipt image (required), bill name (optional), and participants (optional).*
- [x] OCR service — *New `receiptOcr.ts` using tesseract.js to extract raw text from receipt images (English + Thai)*
- [x] Receipt text parser — *New `receiptParser.ts` to parse raw OCR text into structured data (store name, items with amounts, total) using regex*
- [x] Auto-fill bill form from parsed data — *On submission with image: process → open new pre-filled review modal → user reviews/edits → submits into existing flow*
- [x] Optimized image upload flow — *When uploading a receipt, all other fields (bill name, items/total, participants) are optional. User data entered alongside the image (participants, bill name) carries forward to the review modal. User-entered bill name takes priority over OCR store name.*

### Phase 5: Payment Integration — NOT STARTED
- [ ] Integration with payment services (PromptPay QR, etc.) — *Generate PromptPay QR codes for easy payment, and optionally verify payments via e-Slip QR*

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

### Item-based — Pending Selection State
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
DATABASE_PATH=./data/copter.db
DEFAULT_CURRENCY=THB
REMINDER_CRON=0 9 * * *    # Daily at 9 AM
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
#    - Add slash command: /copter
#    - Enable Interactivity
#    - Add required bot scopes
#    - Install to workspace

# 4. Run in development
pnpm dev

# 5. Test in Slack
#    Type: /copter create
```

---

## Key Design Decisions

1. **SQLite for MVP** - Zero setup, single file DB. Can migrate to PostgreSQL for production.
2. **Socket Mode for dev** - No need for ngrok/public URL during development.
3. **Creator confirms payments** - Since this is not connected to real banking, the bill creator acts as the "source of truth" for payment verification.
6. **Creator auto-paid** - The bill creator is always included as a participant and auto-marked as paid. They paid the bill upfront and collect from others — no need to pay themselves.
4. **Channel-scoped bills** - Bills are tied to channels for context, but users can see all their bills via `/copter me`.
5. **Block Kit for rich UI** - Slack's Block Kit provides interactive buttons, modals, and rich formatting for a smooth in-Slack experience.
