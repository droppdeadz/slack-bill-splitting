# Slack Bill Splitting

> Inspired by KBANK's [Khunthong (ขุนทอง)](https://www.kasikornbank.com/en/News/Pages/Khunthong.aspx) — a popular LINE chatbot in Thailand for group expense splitting.

A Slack bot focused on bill splitting and payment tracking. Create bills, split expenses among teammates, track who has paid, and send reminders — all without leaving your Slack workspace.

## Features

- `/<command> create` — Open a form to create a new bill. Choose between **Enter Manually** (type in bill details) or **Upload Receipt Image** (scan a receipt to auto-fill items via OCR). In manual mode all fields are required; in upload mode only the image is required and bill name/participants carry forward to the review modal.
- `/<command> list` — View all active bills in the current channel
- `/<command> me` — See your outstanding bills across all channels
- `/<command> history` — Browse completed and cancelled bills
- `/<command> payment` — Set up your payment methods (PromptPay and/or bank account)

> The slash command name is configurable via the `SLASH_COMMAND` environment variable (default: `slack-bill-splitting`). Set it to match whatever you configured at https://api.slack.com/apps.

### How It Works

**Equal split** — Enter a total amount and participants. Everyone pays the same. Simple.

> **Note:** The bill creator is always automatically included as a participant and marked as paid — they paid the bill upfront and collect from others.

**Item-based split** — Enter individual items with costs and select participants:
1. Bot **DMs each participant** to select which items they owe for
2. Once everyone has selected, the **creator finalizes** the calculation
3. Per-person amounts are computed and **payment tracking** begins

Both flows end with: participants click **Mark as Paid**, optionally attach a payment slip (photo/screenshot), creator confirms (with the slip visible if provided), and the bill auto-completes when everyone has paid.

### Payment Methods

Bill creators can run `/<command> payment` to save their **PromptPay** (type + ID) and/or **bank account** (bank, account number, holder name). When set, active bill cards show extra buttons:
- **Pay via PromptPay** — generates a QR code with the participant's amount for easy mobile banking payment
- **Payment Info** — shows bank account details for direct transfer

### Slip Verification (Optional)

If `OPENSLIPVERIFY_API_KEY` is set, the bot automatically verifies payment slips. When a participant uploads a slip image via "Mark as Paid", the bot extracts the QR code, reads the transaction reference, and calls the [OpenSlipVerify](https://openslipverify.com) API. Verification results appear in the creator's confirmation DM. If verification fails or no API key is set, the manual confirm/reject flow works as before.

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
| QR Code         | [promptpay-qr](https://github.com/nicecatch/promptpay-qr) + [qrcode](https://github.com/soldair/node-qrcode) |
| Slip Verify     | [jsQR](https://github.com/nicecatch/jsQR) + [sharp](https://sharp.pixelplumbing.com/) + [promptparse](https://github.com/maythiwat/promptparse) + [OpenSlipVerify](https://openslipverify.com) |
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
- Add bot scopes: `commands`, `chat:write`, `chat:write.public`, `im:write`, `users:read`, `files:read`, `files:write`
- Create a slash command (e.g. `/split`, `/bill` — or any name you prefer)
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
DATABASE_PATH=./data/bills.db
DEFAULT_CURRENCY=THB
REMINDER_CRON=0 9 * * *
SLASH_COMMAND=slack-bill-splitting
OPENSLIPVERIFY_API_KEY=     # Optional: for automatic slip verification
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
⚡ Slack Bill Splitting bot is running on port 3000
```

### 5. Test in Slack

Type your slash command (e.g. `/<command> create`) in any channel to create your first bill.

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
│   ├── itemSelection.ts    # Item selection CRUD operations
│   └── paymentMethod.ts    # Payment method CRUD (PromptPay + bank account)
├── commands/
│   ├── create.ts           # /<command> create — modal, submission & bill creation
│   ├── list.ts             # /<command> list
│   ├── me.ts               # /<command> me
│   ├── history.ts          # /<command> history
│   └── payment.ts          # /<command> payment — payment method setup
├── actions/
│   ├── markPaid.ts         # "Mark as Paid" button + modal + slip verification
│   ├── confirmPayment.ts   # Creator confirms/rejects payment
│   ├── selectItems.ts      # Participant selects items via DM
│   ├── completeCalc.ts     # Creator finalizes bill calculation
│   ├── manageBill.ts       # "Manage Bill" button → creator-only modal
│   ├── remindAll.ts        # "Remind All" action handler
│   ├── cancelBill.ts       # "Cancel Bill" action handler
│   ├── viewDetails.ts      # "View Details" button handler
│   └── paymentInfo.ts      # "Pay via PromptPay" & "Payment Info" handlers
├── views/
│   ├── createBillModal.ts  # Modal form (items + participants)
│   ├── markPaidModal.ts    # Modal for marking paid with optional slip upload
│   ├── billCard.ts         # Bill card (pending/active states)
│   ├── itemSelectMessage.ts # DM item selection for participants
│   ├── reminderMessage.ts  # DM reminder message
│   ├── resultModal.ts      # Shared result modal for manage bill actions
│   ├── paymentModal.ts     # Modal for payment method setup
│   └── paymentInfoMessage.ts # Ephemeral PromptPay QR & bank info messages
├── services/
│   ├── receiptOcr.ts       # tesseract.js OCR wrapper for receipt images
│   ├── receiptParser.ts    # Regex parser: raw OCR text → structured receipt data
│   ├── promptPayQr.ts      # PromptPay QR code generation (PNG buffer)
│   └── slipVerify.ts       # Slip verification via jsQR + OpenSlipVerify
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

**Completed:** Equal split, item-based split (enter items + costs, participants self-select items via DM, creator finalizes calculation), payment confirmation flow with optional payment slip upload, bill management commands, manual & automatic reminders, list filters, DM for outstanding bills, full bill status lifecycle (pending/active/completed/cancelled), bill owner auto-included and auto-paid, receipt image scanning (OCR to auto-fill items from receipt photos), payment method management (PromptPay + bank account), PromptPay QR code generation on bill cards, bank account info display, automatic slip verification via OpenSlipVerify.

## License

MIT
