# Copter Slack Bot - Setup Guide

> A step-by-step guide for setting up the Copter bill splitting bot (inspired by KBANK's Khunthong) on your Slack workspace.

---

## Step 1: Create a Slack App

1. Go to **https://api.slack.com/apps**
2. Click **"Create New App"** → Choose **"From scratch"**
3. Enter:
   - **App Name:** `Copter`
   - **Workspace:** Select your workspace
4. Click **"Create App"**

---

## Step 2: Enable Socket Mode

1. In the left sidebar, click **"Socket Mode"**
2. Toggle **"Enable Socket Mode"** to ON
3. Give the token a name: `copter-socket`
4. Click **"Generate"**
5. **Copy the `xapp-...` token** → Save it as `SLACK_APP_TOKEN` in your `.env` file

---

## Step 3: Add Bot Permissions

1. In the left sidebar, click **"OAuth & Permissions"**
2. Scroll to **"Scopes" → "Bot Token Scopes"**
3. Add these scopes:
   - `chat:write` — Send and update messages
   - `chat:write.public` — Send messages to channels the bot isn't in
   - `commands` — Add slash commands
   - `files:read` — Read uploaded payment slips and receipt images for OCR
   - `im:write` — Send direct messages (reminders & the `me` subcommand)
   - `users:read` — Read user display names

---

## Step 4: Create the Slash Command

1. In the left sidebar, click **"Slash Commands"**
2. Click **"Create New Command"**
3. Fill in:
   - **Command:** Any name you like (e.g. `/copter`, `/split`, `/bill`)
   - **Short Description:** `Split bills and collect money from your team`
   - **Usage Hint:** `[create | list [all|mine|owed] | me | history | help]`
4. Click **"Save"**
5. **Important:** Set the `SLASH_COMMAND` env var to match the command name you chose (without the `/`). For example, if you created `/split`, set `SLASH_COMMAND=split`.

---

## Step 5: Enable Interactivity

1. In the left sidebar, click **"Interactivity & Shortcuts"**
2. Toggle **"Interactivity"** to ON
3. For **Request URL**, enter any URL for now (Socket Mode doesn't need it, but the field is required)
   - Example: `https://localhost:3000/slack/events`
4. Click **"Save Changes"**

---

## Step 6: Install the App

1. In the left sidebar, click **"Install App"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. **Copy the `xoxb-...` Bot Token** → Save it as `SLACK_BOT_TOKEN` in your `.env` file

---

## Step 7: Get the Signing Secret

1. In the left sidebar, click **"Basic Information"**
2. Under **"App Credentials"**, find **"Signing Secret"**
3. Click **"Show"** and copy it → Save it as `SLACK_SIGNING_SECRET` in your `.env` file

---

## Step 8: Configure Environment

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Fill in your tokens and command name:
   ```
   SLACK_BOT_TOKEN=xoxb-your-token-here
   SLACK_SIGNING_SECRET=your-secret-here
   SLACK_APP_TOKEN=xapp-your-token-here
   SLASH_COMMAND=slack-bill-splitting
   ```
   > Set `SLASH_COMMAND` to match the slash command name you created in Step 4 (without the `/`).

---

## Step 9: Run the Bot

```bash
# Install dependencies
pnpm install

# Start the bot
pnpm dev
```

You should see:
```
[DB] Database initialized successfully
[Scheduler] Auto-reminders scheduled: 0 9 * * *
⚡ Copter bot is running on port 3000
```

---

## Step 10: Test It!

1. Go to any Slack channel
2. Type `/<your-command> help` — You should see the help message
3. Type `/<your-command> create` — A form should pop up
4. Fill in a bill name, amount, and select participants
5. The bill card should appear in the channel

---

## How It Works (For Non-Developers)

### Creating a Bill
Type your slash command (e.g. `/copter create`) in any channel. A form pops up where you first choose how to create the bill:

- **Enter Manually** (default) — Fill in bill details yourself. All fields are required: bill name, split type, amount/items, and participants.
  - *Equal split* — Enter a total amount and select participants. Everyone pays the same and payment tracking starts immediately.
  - *Item-based split* — Enter individual items with their costs (one per line, e.g. "Salmon Sushi 350") and select participants. The total is calculated automatically from the items. The bot DMs each participant with a checklist to select which items they owe for. Shared items are split equally among everyone who selects them. Once all participants have selected, the bill card shows a "Complete Calculation" button for the creator to finalize per-person amounts and begin payment tracking.
- **Upload Receipt Image** — Upload a receipt photo and click "Scan Receipt". Only the image is required; bill name and participants are optional. The bot scans the receipt and opens a review modal with items pre-filled. If you also entered a bill name or selected participants, those carry forward to the review modal.

> **The bill creator is always included** as a participant automatically and their share is marked as paid — since they paid the bill upfront and are collecting from others.

### Paying a Bill
Once a bill is in payment tracking, click the **"Mark as Paid"** button on the bill card. A popup lets you optionally attach a payment slip (photo or screenshot) — skip this if you paid with cash. The bill creator gets a DM with your payment slip (if attached) and buttons to confirm or reject. (The bill owner cannot use "Mark as Paid" since they are already marked as paid.)

### Getting Reminders
The bill creator can click **"Manage Bill"** → **"Remind All"** to send DM reminders to everyone who hasn't paid yet. Only the bill creator sees the manage options. The bot also sends automatic daily reminders at 9 AM.

### Checking Your Bills
- `/<command> me` — Get a DM with all bills you still owe
- `/<command> list` — See all active bills in the current channel
- `/<command> list mine` — See only bills you created
- `/<command> list owed` — See only bills you owe on
- `/<command> history` — See past completed/cancelled bills

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Slash command doesn't work | Make sure the bot is running (`pnpm dev`) and `SLASH_COMMAND` matches your Slack app config |
| "not_in_channel" error | Invite the bot to the channel: `/invite @Copter` |
| Modal doesn't open | Check that Interactivity is enabled in Slack App settings |
| No DM reminders | Check that the bot has `im:write` scope |
| Bot crashes on start | Verify all 3 tokens in `.env` are correct |
