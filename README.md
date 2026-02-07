# Copter - Bill Splitting Bot for Slack

> Inspired by KBANK's [Khunthong (ขุนทอง)](https://www.kasikornbank.com/en/News/Pages/Khunthong.aspx) — a popular LINE chatbot in Thailand for group expense splitting.

A Slack bot focused on bill splitting and payment tracking. Create bills, split expenses among teammates, track who has paid, and send reminders — all without leaving your Slack workspace.

## Features

- `/copter create` — Open a form to create a new bill. Choose between **Enter Manually** (type in bill details) or **Upload Receipt Image** (scan a receipt to auto-fill items via OCR). In manual mode all fields are required; in upload mode only the image is required and bill name/participants carry forward to the review modal.
- `/copter list` — View all active bills in the current channel
- `/copter me` — See your outstanding bills across all channels
- `/copter history` — Browse completed and cancelled bills

### How It Works

**Equal split** — Enter a total amount and participants. Everyone pays the same. Simple.

> **Note:** The bill creator is always automatically included as a participant and marked as paid — they paid the bill upfront and collect from others.

**Item-based split** — Enter individual items with costs and select participants:
1. Bot **DMs each participant** to select which items they owe for
2. Once everyone has selected, the **creator finalizes** the calculation
3. Per-person amounts are computed and **payment tracking** begins

Both flows end with: participants click **Mark as Paid**, optionally attach a payment slip (photo/screenshot), creator confirms (with the slip visible if provided), and the bill auto-completes when everyone has paid.

### Reminders

- **Manual:** Creator clicks **Manage Bill** → **Remind All** to DM all unpaid participants
- **Automatic:** Daily reminders at a configurable time (default: 9 AM)

## Tech Stack

| Layer           | Technology                                                    |
|-----------------|---------------------------------------------------------------|
| Runtime         | Node.js (v20+)                                                |
| Framework       | [Bolt for Slack](https://slack.dev/bolt-js) (Socket Mode)     |
| Language        | TypeScript                                                    |
| Database        | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Scheduler       | node-cron                                                     |
| OCR             | [tesseract.js](https://github.com/naptha/tesseract.js) (local, no API key) |
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

See [plan/SETUP_GUIDE.md](plan/SETUP_GUIDE.md) for detailed step-by-step instructions on creating and configuring your Slack app.

Quick summary of what you'll need:
- Create a new app at https://api.slack.com/apps
- Enable **Socket Mode** and generate an app-level token (`xapp-...`)
- Add bot scopes: `commands`, `chat:write`, `chat:write.public`, `im:write`, `users:read`, `files:read`
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
│   ├── schema.ts           # DB schema & table creation
│   ├── connection.ts       # DB connection
│   └── migrate.ts          # Database migration runner
├── models/
│   ├── bill.ts             # Bill CRUD operations
│   ├── billItem.ts         # Bill item CRUD operations
│   ├── participant.ts      # Participant CRUD operations
│   └── itemSelection.ts    # Item selection CRUD operations
├── commands/
│   ├── create.ts           # /copter create — modal, submission & bill creation
│   ├── list.ts             # /copter list
│   ├── me.ts               # /copter me
│   └── history.ts          # /copter history
├── actions/
│   ├── markPaid.ts         # "Mark as Paid" button + modal submission handler
│   ├── confirmPayment.ts   # Creator confirms/rejects payment
│   ├── selectItems.ts      # Participant selects items via DM
│   ├── completeCalc.ts     # Creator finalizes bill calculation
│   ├── manageBill.ts       # "Manage Bill" button → creator-only modal
│   ├── remindAll.ts        # "Remind All" action handler
│   ├── cancelBill.ts       # "Cancel Bill" action handler
│   └── viewDetails.ts      # "View Details" button handler
├── views/
│   ├── createBillModal.ts  # Modal form (items + participants)
│   ├── markPaidModal.ts    # Modal for marking paid with optional slip upload
│   ├── billCard.ts         # Bill card (pending/active states)
│   ├── itemSelectMessage.ts # DM item selection for participants
│   ├── reminderMessage.ts  # DM reminder message
│   └── resultModal.ts      # Shared result modal for manage bill actions
├── services/
│   ├── receiptOcr.ts       # tesseract.js OCR wrapper for receipt images
│   └── receiptParser.ts    # Regex parser: raw OCR text → structured receipt data
├── scheduler/
│   └── reminders.ts        # Cron job for auto-reminders
└── utils/
    ├── formatCurrency.ts   # Format amounts (e.g., ฿1,320)
    └── splitCalculator.ts  # Calculate equal splits & per-person amounts
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start with hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled output |
| `pnpm db:reset` | Delete the database and restart (fresh start) |

## Roadmap

See [plan/PLAN.md](plan/PLAN.md) for the full implementation plan and roadmap.

**Completed:** Equal split, item-based split (enter items + costs, participants self-select items via DM, creator finalizes calculation), payment confirmation flow with optional payment slip upload, bill management commands, manual & automatic reminders, list filters, DM for outstanding bills, full bill status lifecycle (pending/active/completed/cancelled), bill owner auto-included and auto-paid, receipt image scanning (OCR to auto-fill items from receipt photos).

**Coming next:** Payment integration (PromptPay QR).

## License

MIT
