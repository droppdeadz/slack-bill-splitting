# Copter for Slack - Implementation Plan

> Inspired by KBANK's Khunthong (ขุนทอง) - a group bill splitting & money collection bot for Slack.

## Overview

Copter Slack Bot allows users to create bills, split expenses among group members, track payments, and send reminders - all within Slack channels and DMs.

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
- `chat:write` - Post messages
- `chat:update` - Update bill cards
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
- [x] `/copter me` - View my outstanding bills (ephemeral in channel)
- [x] `/copter history` - View past bills
- [x] `Cancel Bill` functionality (creator only)

> **Note:** Remaining gaps for list filters and `/copter me` DM are tracked in Phase 3 below.

### Phase 3: Reminders & Polish — COMPLETED
- [x] `Remind All` button - manual reminders via DM
- [x] Automatic daily reminders (node-cron)
- [x] Custom split amounts (non-equal) — *Dynamic modal updates: when "Custom Amounts" is selected and participants are chosen, per-participant amount inputs appear. Validates that custom amounts sum to the total.*
- [x] Bill summary when all participants have paid (auto-completes bill)
- [x] `/copter list` filters — *`/copter list all` (default), `/copter list mine` (bills I created), `/copter list owed` (bills I owe on). Filter hint shown in response.*
- [x] `/copter me` as true DM — *Opens a DM conversation with the user and posts the outstanding bills summary there. Shows brief ephemeral confirmation in the original channel.*

### Phase 4: Recurring & Multi-bill — NOT STARTED
> Inspired by Khunthong's recurring monthly bills (หารบิลแบบรายเดือน) and multi-bill trip settlement features.
- [ ] Recurring/monthly bills — *For shared subscriptions (Netflix, Spotify, YouTube Premium), rent, utilities. Config: day/time, frequency, duration, custom amounts per person. Original Khunthong carries unpaid balances forward to next period.*
- [ ] Multi-bill trip settlement — *Aggregate multiple bills from a trip/outing and calculate net settlement amounts (who owes whom), reducing N transactions to minimal transfers*
- [ ] Multi-currency support — *Partially scaffolded: DB stores currency, `formatCurrency` supports 5 currencies, but users cannot select currency in the modal (defaults to env config). Original Khunthong provides exchange rate info via `#ค่าเงิน`.*

### Phase 5: Gamification & Social — NOT STARTED
> Inspired by Khunthong's medal system and social features that drive engagement and prompt payments.
- [ ] Payment speed medals (gold/silver/bronze) — *Original Khunthong awards medals based on how quickly participants pay, creating social incentive and gamification*
- [ ] Payment streaks / stats — *Track payment behavior over time (e.g., "always pays within 1 hour")*
- [ ] Social wallet (group savings pool) — *Original Khunthong's "เก็บเงินกลุ่ม" feature where everyone contributes toward a shared goal (e.g., group vacation fund)*

### Phase 6: Platform & Integration — NOT STARTED
- [ ] Slack Home Tab dashboard — *Personal overview: active bills, outstanding debts, payment history at a glance*
- [ ] Expense analytics / monthly summary — *Spending breakdown by channel, category, or time period*
- [ ] Integration with payment services (PromptPay QR, etc.) — *Original Khunthong integrates with K PLUS and verifies e-Slip QR codes from any Thai bank*
- [ ] `@copter` mention support — *Allow `@copter create` as alternative to slash commands (event subscription already scaffolded in app config)*

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
5. **Block Kit for rich UI** - Slack's Block Kit provides interactive buttons, modals, and rich formatting similar to the original KBANK Khunthong UI.
