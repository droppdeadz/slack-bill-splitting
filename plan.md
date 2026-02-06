# Copter for Slack - Implementation Plan

> Inspired by KBANK's Khunthong (ขุนทอง) — a popular LINE chatbot for group expense splitting.

## Overview

Copter is a Slack bot focused on bill splitting and payment tracking. Create bills, split expenses among group members, track who has paid, and send reminders — all within Slack channels and DMs.

---

## Core Features

### 1. Create a Bill (`/copter create`)
- Creator specifies: **bill name**, **total amount**, and **participants** (mention @users)
- Supports **equal split** or **custom amounts** per person
- Posts an interactive bill card in the channel

### 2. Bill Card (Interactive Message)
- Displays: bill name, total amount, creator, and each participant with their owed amount
- Shows payment status per person: **Paid** / **Unpaid**
- Buttons: `Mark as Paid`, `Remind All`, `View Details`, `Cancel Bill`

### 3. Mark as Paid
- Participant clicks `Mark as Paid` on the bill card
- Creator receives a notification to **confirm** or **reject** the payment
- Once confirmed, the bill card updates in real-time

### 4. Payment Reminders
- Creator can click `Remind All` to send DM reminders to unpaid participants
- Automatic reminders can be scheduled (e.g., daily at 9 AM for outstanding bills)
- Participants get a DM with a summary of all their unpaid bills

### 5. Bill Summary (`/copter list`)
- Shows all active bills in the current channel
- Filter by: `created by me`, `owed by me`, `all`

### 6. My Outstanding Bills (`/copter me`)
- DM the user a summary of all bills they owe across all channels

### 7. Bill History (`/copter history`)
- View completed/cancelled bills

---

## User Flows

### Flow 1: Creating a Bill
```
User types: /copter create
  -> Modal opens with form:
     - Bill name (e.g., "Lunch at Sushi place")
     - Total amount (e.g., 1,320)
     - Split type: Equal / Custom
     - Participants: Select @users
  -> Bot posts bill card in channel
```

### Flow 2: Paying a Bill
```
Participant sees bill card in channel
  -> Clicks "Mark as Paid"
  -> Creator gets DM: "@user says they paid for 'Lunch'. Confirm?"
  -> Creator clicks "Confirm"
  -> Bill card updates: user shows as Paid with checkmark
  -> If all paid -> Bill marked as "Completed"
```

### Flow 3: Sending Reminders
```
Creator clicks "Remind All" on bill card
  -> Bot sends DM to each unpaid participant:
     "Reminder: You owe 330 for 'Lunch at Sushi place'
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
│   │   └── participant.ts      # Participant CRUD operations
│   ├── commands/
│   │   ├── create.ts           # /copter create
│   │   ├── list.ts             # /copter list
│   │   ├── me.ts               # /copter me
│   │   └── history.ts          # /copter history
│   ├── actions/
│   │   ├── markPaid.ts         # "Mark as Paid" button handler
│   │   ├── confirmPayment.ts   # Creator confirms payment
│   │   ├── remindAll.ts        # "Remind All" button handler
│   │   ├── cancelBill.ts       # "Cancel Bill" button handler
│   │   └── viewDetails.ts     # "View Details" button handler
│   ├── views/
│   │   ├── createBillModal.ts  # Modal form for creating bill
│   │   ├── billCard.ts         # Bill card Block Kit message
│   │   └── reminderMessage.ts  # DM reminder message
│   ├── scheduler/
│   │   └── reminders.ts        # Cron job for auto-reminders
│   └── utils/
│       ├── formatCurrency.ts   # Format amounts (e.g., ฿1,320)
│       └── splitCalculator.ts  # Calculate equal/custom splits
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
| split_type   | TEXT      | "equal" or "custom"               |
| creator_id   | TEXT      | Slack user ID of creator          |
| channel_id   | TEXT      | Slack channel where bill was posted |
| message_ts   | TEXT      | Slack message timestamp (for updating) |
| status       | TEXT      | "active", "completed", "cancelled" |
| created_at   | DATETIME  | Timestamp                         |
| updated_at   | DATETIME  | Timestamp                         |

### `participants` table
| Column     | Type      | Description                    |
|------------|-----------|--------------------------------|
| id         | TEXT (PK) | UUID                           |
| bill_id    | TEXT (FK) | Reference to bill              |
| user_id    | TEXT      | Slack user ID                  |
| amount     | REAL      | Amount this person owes        |
| status     | TEXT      | "unpaid", "pending", "paid"    |
| paid_at    | DATETIME  | When payment was confirmed     |
| created_at | DATETIME  | Timestamp                      |

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

### Phase 3: Reminders & Polish — COMPLETED
- [x] `Remind All` button - manual reminders via DM
- [x] Automatic daily reminders (node-cron)
- [x] Custom split amounts (non-equal) — *Dynamic modal updates: when "Custom Amounts" is selected and participants are chosen, per-participant amount inputs appear. Each selected user must have their owed amount filled in. Validates that custom amounts sum to the total.*
- [x] Bill summary when all participants have paid (auto-completes bill)
- [x] `/copter list` filters — *`/copter list all` (default), `/copter list mine` (bills I created), `/copter list owed` (bills I owe on). Filter hint shown in response.*
- [x] `/copter me` as true DM — *Opens a DM conversation with the user and posts the outstanding bills summary there. Shows brief ephemeral confirmation in the original channel.*

### Phase 4: Bill Image Recognition — NOT STARTED
> Automatically read bills from uploaded images and pre-fill the create bill form. Currently, the bill owner must enter all details manually.
- [ ] Receipt/bill image upload in create modal — *Allow users to upload a photo of a receipt or bill*
- [ ] OCR / image parsing — *Extract bill items, amounts, and total from the uploaded image*
- [ ] Auto-fill bill form from parsed data — *Pre-populate bill name, total amount, and optionally line items from the parsed receipt*

### Phase 5: Payment Integration — NOT STARTED
- [ ] Integration with payment services (PromptPay QR, etc.) — *Generate PromptPay QR codes for easy payment, and optionally verify payments via e-Slip QR*

---

## Bill Card Design (Block Kit)

```
┌──────────────────────────────────────┐
│  Lunch at Sushi Place       ฿1,320  │
│  Created by @Sea_Talay              │
│  Split equally (4 people)           │
│─────────────────────────────────────│
│  @Danit          ฿330        Paid   │
│  @Grace          ฿330      Unpaid   │
│  @Kong           ฿330      Unpaid   │
│  @Nut            ฿330      Unpaid   │
│─────────────────────────────────────│
│  Collected: ฿330 / ฿1,320          │
│  ██████░░░░░░░░░░░░░░  25%         │
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
