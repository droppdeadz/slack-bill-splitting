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
import { registerPaymentHandlers, openPaymentModal } from "./commands/payment";
import { registerPaymentInfoAction } from "./actions/paymentInfo";
import { startReminderScheduler } from "./scheduler/reminders";
import { startFileCleanupScheduler } from "./scheduler/fileCleanup";
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
const cmd = config.slashCommand;
app.command(`/${cmd}`, async ({ command, ack, client, body }) => {
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

    case "payment":
      await ack();
      await openPaymentModal(client, body.trigger_id, command.user_id);
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
            text: { type: "plain_text", text: "Slack Bill Splitting" },
          },
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                "*Available Commands:*",
                "",
                `\`/${cmd} create\` — Create a new bill and split it`,
                `\`/${cmd} list [all|mine|owed]\` — View active bills in this channel`,
                `\`/${cmd} me\` — View your outstanding bills (sent as DM)`,
                `\`/${cmd} history\` — View completed/cancelled bills`,
                `\`/${cmd} payment\` — Set up your payment methods (PromptPay / bank account)`,
                `\`/${cmd} help\` — Show this help message`,
              ].join("\n"),
            },
          },
        ],
        text: `${cmd} commands: create, list, me, history, payment, help`,
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
registerPaymentHandlers(app);
registerPaymentInfoAction(app);

// ── Scheduler ─────────────────────────────────────
startReminderScheduler(app);
startFileCleanupScheduler(app);

// ── Start ─────────────────────────────────────────
(async () => {
  await app.start(config.port);
  console.log(`⚡ Slack Bill Splitting bot is running on port ${config.port}`);
  console.log(`   Commands: /${cmd} [create|list|me|history|payment|help]`);
})();
