import { App } from "@slack/bolt";
import { config } from "./config";
import { initializeDatabase } from "./database/schema";
import { registerCreateCommand } from "./commands/create";
import { handleListCommand } from "./commands/list";
import { handleMeCommand } from "./commands/me";
import { handleHistoryCommand } from "./commands/history";
import { registerMarkPaidAction } from "./actions/markPaid";
import { registerConfirmPaymentAction } from "./actions/confirmPayment";
import { registerRemindAllAction } from "./actions/remindAll";
import { registerCancelBillAction } from "./actions/cancelBill";
import { registerViewDetailsAction } from "./actions/viewDetails";
import { startReminderScheduler } from "./scheduler/reminders";

// Initialize the Slack app (Socket Mode for development)
const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  appToken: config.slack.appToken,
  socketMode: true,
});

// ── Database ──────────────────────────────────────
initializeDatabase();

// ── Slash Command Router ──────────────────────────
// /copter [create|list|me|history|help]
app.command("/copter", async ({ command, ack, client, body }) => {
  const subcommand = command.text.trim().split(/\s+/)[0] || "help";

  switch (subcommand) {
    case "create":
      // Handled by registerCreateCommand (opens modal)
      // We need to ack and open modal here since Bolt matches first handler
      await ack();
      const { buildCreateBillModal } = await import("./views/createBillModal");
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          ...buildCreateBillModal(),
          private_metadata: JSON.stringify({
            channel_id: command.channel_id,
          }),
        },
      });
      break;

    case "list":
      await ack();
      await handleListCommand(client, command.channel_id, command.user_id);
      break;

    case "me":
      await ack();
      await handleMeCommand(client, command.channel_id, command.user_id);
      break;

    case "history":
      await ack();
      await handleHistoryCommand(client, command.channel_id, command.user_id);
      break;

    case "help":
    default:
      await ack();
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Copter - Bill Splitting Bot" },
          },
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                "*Available Commands:*",
                "",
                "`/copter create` — Create a new bill and split it",
                "`/copter list` — View active bills in this channel",
                "`/copter me` — View your outstanding bills",
                "`/copter history` — View completed/cancelled bills",
                "`/copter help` — Show this help message",
              ].join("\n"),
            },
          },
        ],
        text: "Copter commands: create, list, me, history, help",
      });
      break;
  }
});

// ── Modal Submission ──────────────────────────────
// Register the create bill modal handler separately
import { createBill, getBillById, updateBillMessageTs } from "./models/bill";
import { addParticipantsBulk, getParticipantsByBill } from "./models/participant";
import { buildBillCard } from "./views/billCard";
import { splitEqual } from "./utils/splitCalculator";

app.view("create_bill_modal", async ({ ack, view, client, body }) => {
  const values = view.state.values;
  const billName = values.bill_name.bill_name_input.value!;
  const totalAmountStr = values.total_amount.total_amount_input.value!;
  const splitType = values.split_type.split_type_input.selected_option!.value as "equal" | "custom";
  const participantIds = values.participants.participants_input.selected_users!;

  const totalAmount = parseFloat(totalAmountStr);

  if (isNaN(totalAmount) || totalAmount <= 0) {
    await ack({
      response_action: "errors",
      errors: { total_amount: "Please enter a valid positive number" },
    });
    return;
  }

  if (participantIds.length === 0) {
    await ack({
      response_action: "errors",
      errors: { participants: "Please select at least one participant" },
    });
    return;
  }

  await ack();

  const metadata = JSON.parse(view.private_metadata);
  const channelId = metadata.channel_id;
  const creatorId = body.user.id;

  const bill = createBill({
    name: billName,
    totalAmount,
    splitType,
    creatorId,
    channelId,
  });

  const amounts = splitEqual(totalAmount, participantIds.length);
  const participantData = participantIds.map((userId: string, i: number) => ({
    userId,
    amount: amounts[i],
  }));

  addParticipantsBulk(bill.id, participantData);

  const participants = getParticipantsByBill(bill.id);
  const freshBill = getBillById(bill.id)!;

  const result = await client.chat.postMessage({
    channel: channelId,
    blocks: buildBillCard(freshBill, participants),
    text: `New bill: ${billName} - ${totalAmount}`,
  });

  if (result.ts) {
    updateBillMessageTs(bill.id, result.ts);
  }
});

// ── Button Actions ────────────────────────────────
registerMarkPaidAction(app);
registerConfirmPaymentAction(app);
registerRemindAllAction(app);
registerCancelBillAction(app);
registerViewDetailsAction(app);

// ── Scheduler ─────────────────────────────────────
startReminderScheduler(app);

// ── Start ─────────────────────────────────────────
(async () => {
  await app.start(config.port);
  console.log(`⚡ Copter bot is running on port ${config.port}`);
  console.log("   Commands: /copter [create|list|me|history|help]");
})();
