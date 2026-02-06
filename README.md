# Copter - Bill Splitting Bot for Slack

> Inspired by KBANK's [Khunthong (ขุนทอง)](https://www.kasikornbank.com/en/News/Pages/Khunthong.aspx) — a popular LINE chatbot in Thailand for group expense splitting.

A Slack bot focused on bill splitting and payment tracking. Create bills, split expenses among teammates, track who has paid, and send reminders — all without leaving your Slack workspace.

## Features

- `/copter create` — Open a form to create a new bill with participants and split amounts
- `/copter list` — View all active bills in the current channel
- `/copter me` — See your outstanding bills across all channels
- `/copter history` — Browse completed and cancelled bills

### Bill Card

Each bill is posted as an interactive card in the channel:

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

### Payment Flow

1. A participant clicks **Mark as Paid** on the bill card
2. The bill creator receives a DM to **confirm** or **reject** the payment
3. Once confirmed, the bill card updates in real-time
4. When all participants have paid, the bill auto-completes

### Reminders

- **Manual:** Creator clicks **Remind All** to DM all unpaid participants
- **Automatic:** Daily reminders at a configurable time (default: 9 AM)

## Tech Stack

| Layer           | Technology                                                    |
|-----------------|---------------------------------------------------------------|
| Runtime         | Node.js (v20+)                                                |
| Framework       | [Bolt for Slack](https://slack.dev/bolt-js) (Socket Mode)     |
| Language        | TypeScript                                                    |
| Database        | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Scheduler       | node-cron                                                     |
| Package Manager | pnpm                                                          |

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm
- A Slack workspace where you can install apps

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a Slack App

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed step-by-step instructions on creating and configuring your Slack app.

Quick summary of what you'll need:
- Create a new app at https://api.slack.com/apps
- Enable **Socket Mode** and generate an app-level token (`xapp-...`)
- Add bot scopes: `commands`, `chat:write`, `chat:write.public`, `im:write`, `users:read`
- Create slash command: `/copter`
- Enable **Interactivity**
- Install the app to your workspace and copy the bot token (`xoxb-...`)

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in your tokens:

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
PORT=3000
DATABASE_PATH=./data/copter.db
DEFAULT_CURRENCY=THB
REMINDER_CRON=0 9 * * *
```

### 4. Run the bot

```bash
# Development (with hot reload)
pnpm dev

# Production
pnpm build && pnpm start
```

You should see:

```
[DB] Database initialized successfully
[Scheduler] Auto-reminders scheduled: 0 9 * * *
⚡ Copter bot is running on port 3000
```

### 5. Test in Slack

Type `/copter create` in any channel to create your first bill.

## Project Structure

```
src/
├── app.ts                  # Bolt app entry point & command router
├── config.ts               # Environment configuration
├── database/
│   ├── schema.ts           # DB schema & migrations
│   └── connection.ts       # DB connection
├── models/
│   ├── bill.ts             # Bill CRUD operations
│   └── participant.ts      # Participant CRUD operations
├── commands/
│   ├── create.ts           # /copter create
│   ├── list.ts             # /copter list
│   ├── me.ts               # /copter me
│   └── history.ts          # /copter history
├── actions/
│   ├── markPaid.ts         # "Mark as Paid" button handler
│   ├── confirmPayment.ts   # Creator confirms/rejects payment
│   ├── remindAll.ts        # "Remind All" button handler
│   ├── cancelBill.ts       # "Cancel Bill" button handler
│   └── viewDetails.ts      # "View Details" button handler
├── views/
│   ├── createBillModal.ts  # Modal form for creating bill
│   ├── billCard.ts         # Bill card Block Kit message
│   └── reminderMessage.ts  # DM reminder message
├── scheduler/
│   └── reminders.ts        # Cron job for auto-reminders
└── utils/
    ├── formatCurrency.ts   # Format amounts (e.g., ฿1,320)
    └── splitCalculator.ts  # Calculate equal/custom splits
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start with hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled output |
| `pnpm db:reset` | Delete the database and restart (fresh start) |

## Roadmap

See [plan.md](plan.md) for the full implementation plan and roadmap.

**Completed:** Bill creation, equal & custom splits, payment confirmation flow, bill management commands, manual & automatic reminders, list filters, DM for outstanding bills.

**Coming next:** Bill image recognition (OCR to auto-fill bills from receipt photos), payment integration (PromptPay QR).

## License

MIT
