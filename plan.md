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
- Buttons change based on state: `Cancel Bill` always available for creator
- Payment phase buttons: `Mark as Paid`, `Remind All`, `View Details`

### 5. Mark as Paid
- Participant clicks `Mark as Paid` on the bill card
- Creator receives a notification to **confirm** or **reject** the payment
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

### Flow 1a: Creating a Bill (Equal Split)
```
User types: /copter create
  -> Modal opens with form:
     - Bill name (e.g., "Taxi to airport")
     - Split type: Equal
     - Total amount (e.g., 400)
     - Participants: Select @users
  -> Bot posts bill card in channel (status: active)
  -> Each participant owes total / number of participants
  -> Directly enters payment tracking phase
```

### Flow 1b: Creating a Bill (Item-based Split)
```
User types: /copter create
  -> Modal opens with form:
     - Bill name (e.g., "Lunch at Sushi place")
     - Split type: Item-based
     - Items with costs (e.g., "Salmon Sushi ฿350", "Ramen ฿280", ...)
     - Participants: Select @users
  -> Bot posts bill card in channel (status: pending selection)
  -> Bot DMs each participant to select their items
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
  -> Creator gets DM: "@user says they paid ฿330 for 'Lunch'. Confirm?"
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
| Package Manager| pnpm                              |

---

## Project Structure

```
copter/
├── plan.md
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── app.ts                  # Bolt app entry point
│   ├── config.ts               # Environment config
│   ├── database/
│   │   ├── schema.ts           # DB schema & migrations
│   │   └── connection.ts       # DB connection
│   ├── models/
│   │   ├── bill.ts             # Bill CRUD operations
│   │   ├── billItem.ts         # Bill item CRUD operations
│   │   ├── participant.ts      # Participant CRUD operations
│   │   └── itemSelection.ts    # Item selection CRUD operations
│   ├── commands/
│   │   ├── create.ts           # /copter create
│   │   ├── list.ts             # /copter list
│   │   ├── me.ts               # /copter me
│   │   └── history.ts          # /copter history
│   ├── actions/
│   │   ├── markPaid.ts         # "Mark as Paid" button handler
│   │   ├── confirmPayment.ts   # Creator confirms payment
│   │   ├── selectItems.ts      # Participant selects items via DM
│   │   ├── completeCalc.ts     # Creator finalizes bill calculation
│   │   ├── remindAll.ts        # "Remind All" button handler
│   │   ├── cancelBill.ts       # "Cancel Bill" button handler
│   │   └── viewDetails.ts     # "View Details" button handler
│   ├── views/
│   │   ├── createBillModal.ts  # Modal form for creating bill (items + participants)
│   │   ├── billCard.ts         # Bill card Block Kit message (pending/active states)
│   │   ├── itemSelectMessage.ts # DM item selection checklist for participants
│   │   └── reminderMessage.ts  # DM reminder message
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

### Slash Command
- `/copter` - Main command with subcommands (create, list, me, history)

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

### Phase 3: Item-based Splitting & Polish — IN PROGRESS
- [x] `Remind All` button - manual reminders via DM
- [x] Automatic daily reminders (node-cron)
- [x] Bill summary when all participants have paid (auto-completes bill)
- [x] `/copter list` filters — *`/copter list all` (default), `/copter list mine` (bills I created), `/copter list owed` (bills I owe on). Filter hint shown in response.*
- [x] `/copter me` as true DM — *Opens a DM conversation with the user and posts the outstanding bills summary there. Shows brief ephemeral confirmation in the original channel.*
- [ ] Item-based bill creation — *Add "Item-based" as a split type alongside "Equal". When selected, creator enters bill name, list of items with costs, and selects participants. Total is calculated from items automatically. Replaces the old "Custom Amounts" per-person input.*
- [ ] Participant item selection via DM — *After bill creation, bot DMs each participant with an interactive checklist of items. Participant selects which items they owe for. Shared items (selected by multiple people) have their cost split equally among selectors. Bill card updates selection progress.*
- [ ] Creator finalizes calculation — *Once all participants have selected items, creator is notified and clicks "Complete Calculation". Per-person amounts are computed and the bill moves to active payment tracking.*
- [ ] Bill status lifecycle — *New statuses: "pending" (waiting for item selections), "active" (payment tracking), "completed", "cancelled". Bill card UI adapts to current status.*

### Phase 4: Bill Image Recognition — NOT STARTED
> Automatically read bills from uploaded images and pre-fill the create bill form. Currently, the bill owner must enter all details manually.
- [ ] Receipt/bill image upload in create modal — *Allow users to upload a photo of a receipt or bill*
- [ ] OCR / image parsing — *Extract bill items, amounts, and total from the uploaded image*
- [ ] Auto-fill bill form from parsed data — *Pre-populate bill name, total amount, and optionally line items from the parsed receipt*

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
│  [Mark as Paid] [Remind All] [···]  │
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
│  [Cancel Bill]                      │
└──────────────────────────────────────┘
```

### Item-based — Active Payment State
```
┌──────────────────────────────────────┐
│  Lunch at Sushi Place       ฿1,320  │
│  Created by @Sea_Talay              │
│  4 items · 4 participants           │
│─────────────────────────────────────│
│  @Danit          ฿455        Paid   │
│  @Grace          ฿280      Unpaid   │
│  @Kong           ฿232.50   Unpaid   │
│  @Nut            ฿352.50   Unpaid   │
│─────────────────────────────────────│
│  Collected: ฿455 / ฿1,320          │
│  ████████░░░░░░░░░░░░  34%         │
│─────────────────────────────────────│
│  [Mark as Paid] [Remind All] [···]  │
└──────────────────────────────────────┘
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
4. **Channel-scoped bills** - Bills are tied to channels for context, but users can see all their bills via `/copter me`.
5. **Block Kit for rich UI** - Slack's Block Kit provides interactive buttons, modals, and rich formatting for a smooth in-Slack experience.
