import { App } from "@slack/bolt";
import { config } from "./config";
import { initializeDatabase } from "./database/schema";
import { handleListCommand, type ListFilter } from "./commands/list";
import { handleMeCommand } from "./commands/me";
import { handleHistoryCommand } from "./commands/history";
import { registerMarkPaidAction } from "./actions/markPaid";
import { registerConfirmPaymentAction } from "./actions/confirmPayment";
import { registerRemindAllAction } from "./actions/remindAll";
import { registerCancelBillAction } from "./actions/cancelBill";
import { registerViewDetailsAction } from "./actions/viewDetails";
import { startReminderScheduler } from "./scheduler/reminders";
import { createBill, getBillById, updateBillMessageTs } from "./models/bill";
import { addParticipantsBulk, getParticipantsByBill } from "./models/participant";
import { buildBillCard } from "./views/billCard";
import { splitEqual, validateCustomSplit } from "./utils/splitCalculator";
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

// ── Dynamic Modal Updates (Custom Split) ─────────
// When split_type or participants change, update the modal to show/hide custom amount fields
async function updateCreateModal(body: any, client: any): Promise<void> {
  const view = body.view;
  const values = view.state.values;
  const splitType =
    values.split_type?.split_type_input?.selected_option?.value || "equal";
  const participantIds =
    values.participants?.participants_input?.selected_users || [];

  // Fetch display names for selected participants
  const participantNames: Record<string, string> = {};
  if (splitType === "custom" && participantIds.length > 0) {
    for (const userId of participantIds) {
      try {
        const info = await client.users.info({ user: userId });
        participantNames[userId] =
          info.user?.real_name || info.user?.name || userId;
      } catch {
        participantNames[userId] = userId;
      }
    }
  }

  await client.views.update({
    view_id: view.id,
    hash: view.hash,
    view: {
      ...buildCreateBillModal({
        splitType,
        participantIds,
        participantNames,
      }),
      private_metadata: view.private_metadata,
    },
  });
}

app.action("split_type_input", async ({ ack, body, client }) => {
  await ack();
  await updateCreateModal(body, client);
});

app.action("participants_input", async ({ ack, body, client }) => {
  await ack();
  const view = (body as any).view;
  const values = view?.state?.values;
  const splitType =
    values?.split_type?.split_type_input?.selected_option?.value;
  // Only update modal if custom split is active (to avoid unnecessary updates)
  if (splitType === "custom") {
    await updateCreateModal(body, client);
  }
});

// ── Modal Submission Handler ─────────────────────
app.view("create_bill_modal", async ({ ack, view, client, body }) => {
  const values = view.state.values;
  const billName = values.bill_name.bill_name_input.value!;
  const totalAmountStr = values.total_amount.total_amount_input.value!;
  const splitType = values.split_type.split_type_input.selected_option!
    .value as "equal" | "custom";
  const participantIds =
    values.participants.participants_input.selected_users!;

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

  let participantData: { userId: string; amount: number }[];

  if (splitType === "custom") {
    // Read custom amounts from per-participant input fields
    const customAmounts: number[] = [];
    const errors: Record<string, string> = {};

    for (const userId of participantIds) {
      const blockId = `custom_amount_${userId}`;
      const amountStr = values[blockId]?.custom_amount_input?.value;
      if (!amountStr) {
        errors[blockId] = "Please enter an amount";
        continue;
      }
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors[blockId] = "Please enter a valid positive number";
        continue;
      }
      customAmounts.push(amount);
    }

    if (Object.keys(errors).length > 0) {
      await ack({ response_action: "errors", errors });
      return;
    }

    if (!validateCustomSplit(customAmounts, totalAmount)) {
      // Find the first custom amount block to show the error
      const firstBlockId = `custom_amount_${participantIds[0]}`;
      await ack({
        response_action: "errors",
        errors: {
          [firstBlockId]: `Custom amounts must add up to ${totalAmount}`,
        },
      });
      return;
    }

    participantData = participantIds.map(
      (userId: string, i: number) => ({
        userId,
        amount: customAmounts[i],
      })
    );
  } else {
    const amounts = splitEqual(totalAmount, participantIds.length);
    participantData = participantIds.map(
      (userId: string, i: number) => ({
        userId,
        amount: amounts[i],
      })
    );
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
