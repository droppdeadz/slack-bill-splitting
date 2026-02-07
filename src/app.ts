import { App } from "@slack/bolt";
import { config } from "./config";
import { initializeDatabase } from "./database/schema";
import { runMigrations } from "./database/migrate";
import { handleListCommand, type ListFilter } from "./commands/list";
import { handleMeCommand } from "./commands/me";
import { handleHistoryCommand } from "./commands/history";
import { registerCreateHandlers } from "./commands/create";
import { registerMarkPaidAction } from "./actions/markPaid";
import { registerConfirmPaymentAction } from "./actions/confirmPayment";
import { registerRemindAllAction } from "./actions/remindAll";
import { registerCancelBillAction } from "./actions/cancelBill";
import { registerManageBillAction } from "./actions/manageBill";
import { registerViewDetailsAction } from "./actions/viewDetails";
import { registerSelectItemsAction } from "./actions/selectItems";
import { registerCompleteCalcAction } from "./actions/completeCalc";
import { startReminderScheduler } from "./scheduler/reminders";
import { buildCreateBillModal } from "./views/createBillModal";

// Initialize the Slack app (Socket Mode for development)
const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  appToken: config.slack.appToken,
  socketMode: true,
});

// ── Database ──────────────────────────────────────
initializeDatabase();
runMigrations();

// ── Slash Command Router ──────────────────────────
// /copter [create|list|me|history|help]
app.command("/copter", async ({ command, ack, client, body }) => {
  const subcommand = command.text.trim().split(/\s+/)[0] || "help";

  switch (subcommand) {
    case "create":
      await ack();
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

    case "list": {
      await ack();
      const listArgs = command.text.trim().split(/\s+/);
      const filterArg = listArgs[1] || "all";
      const validFilters: ListFilter[] = ["all", "mine", "owed"];
      const filter: ListFilter = validFilters.includes(filterArg as ListFilter)
        ? (filterArg as ListFilter)
        : "all";
      await handleListCommand(client, command.channel_id, command.user_id, filter);
      break;
    }

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
                "`/copter list [all|mine|owed]` — View active bills in this channel",
                "`/copter me` — View your outstanding bills (sent as DM)",
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

// ── Feature Handlers ─────────────────────────────
registerCreateHandlers(app);
registerMarkPaidAction(app);
registerConfirmPaymentAction(app);
registerRemindAllAction(app);
registerCancelBillAction(app);
registerManageBillAction(app);
registerViewDetailsAction(app);
registerSelectItemsAction(app);
registerCompleteCalcAction(app);

// ── Scheduler ─────────────────────────────────────
startReminderScheduler(app);

// ── Start ─────────────────────────────────────────
(async () => {
  await app.start(config.port);
  console.log(`⚡ Copter bot is running on port ${config.port}`);
  console.log("   Commands: /copter [create|list|me|history|help]");
})();
