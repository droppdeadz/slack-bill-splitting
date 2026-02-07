import { App } from "@slack/bolt";
import { config } from "./config";
import { initializeDatabase } from "./database/schema";
import { runMigrations } from "./database/migrate";
import { handleListCommand, type ListFilter } from "./commands/list";
import { handleMeCommand } from "./commands/me";
import { handleHistoryCommand } from "./commands/history";
import { registerMarkPaidAction } from "./actions/markPaid";
import { registerConfirmPaymentAction } from "./actions/confirmPayment";
import { registerRemindAllAction } from "./actions/remindAll";
import { registerCancelBillAction } from "./actions/cancelBill";
import { registerManageBillAction } from "./actions/manageBill";
import { registerViewDetailsAction } from "./actions/viewDetails";
import { registerSelectItemsAction } from "./actions/selectItems";
import { registerCompleteCalcAction } from "./actions/completeCalc";
import { startReminderScheduler } from "./scheduler/reminders";
import { createBill, getBillById, updateBillMessageTs } from "./models/bill";
import {
  addParticipantsBulk,
  getParticipantsByBill,
  getParticipantById,
  updateParticipantStatus,
} from "./models/participant";
import { addBillItemsBulk, getItemsByBill } from "./models/billItem";
import { buildBillCard } from "./views/billCard";
import { buildItemSelectDM } from "./views/itemSelectMessage";
import { splitEqual } from "./utils/splitCalculator";
import {
  buildCreateBillModal,
  parseItemsInput,
} from "./views/createBillModal";
import { formatCurrency } from "./utils/formatCurrency";

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

// ── Dynamic Modal Updates ─────────────────────────
// When split_type changes, update the modal to show the right fields
app.action("split_type_input", async ({ ack, body, client }) => {
  await ack();

  const view = (body as any).view;
  const values = view.state.values;
  const splitType =
    values.split_type?.split_type_input?.selected_option?.value || "equal";

  await client.views.update({
    view_id: view.id,
    hash: view.hash,
    view: {
      ...buildCreateBillModal({ splitType: splitType as "equal" | "item" }),
      private_metadata: view.private_metadata,
    },
  });
});

// Acknowledge participants_input changes (no modal update needed now)
app.action("participants_input", async ({ ack }) => {
  await ack();
});

// ── Modal Submission Handler ─────────────────────
app.view("create_bill_modal", async ({ ack, view, client, body }) => {
  const values = view.state.values;
  const billName = values.bill_name.bill_name_input.value!;
  const splitType = values.split_type.split_type_input.selected_option!
    .value as "equal" | "item";
  const participantIds =
    values.participants.participants_input.selected_users!;

  if (participantIds.length === 0) {
    await ack({
      response_action: "errors",
      errors: { participants: "Please select at least one participant" },
    });
    return;
  }

  if (splitType === "equal") {
    // ── Equal split flow ──
    const totalAmountStr = values.total_amount?.total_amount_input?.value;

    if (!totalAmountStr) {
      await ack({
        response_action: "errors",
        errors: { total_amount: "Please enter a total amount" },
      });
      return;
    }

    const totalAmount = parseFloat(totalAmountStr);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      await ack({
        response_action: "errors",
        errors: { total_amount: "Please enter a valid positive number" },
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
      splitType: "equal",
      creatorId,
      channelId,
    });

    const amounts = splitEqual(totalAmount, participantIds.length);
    const participantData = participantIds.map(
      (userId: string, i: number) => ({
        userId,
        amount: amounts[i],
      })
    );

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
  } else {
    // ── Item-based split flow ──
    const itemsText = values.items?.items_input?.value;

    if (!itemsText) {
      await ack({
        response_action: "errors",
        errors: { items: "Please enter at least one item" },
      });
      return;
    }

    const parsedItems = parseItemsInput(itemsText);
    if (parsedItems.length === 0) {
      await ack({
        response_action: "errors",
        errors: {
          items:
            'Could not parse any items. Use format: "Item Name 123" (one per line)',
        },
      });
      return;
    }

    const totalAmount = parsedItems.reduce((sum, item) => sum + item.amount, 0);

    await ack();

    const metadata = JSON.parse(view.private_metadata);
    const channelId = metadata.channel_id;
    const creatorId = body.user.id;

    // Create bill in "pending" status
    const bill = createBill({
      name: billName,
      totalAmount,
      splitType: "item",
      creatorId,
      channelId,
    });

    // Add bill items
    const billItems = addBillItemsBulk(bill.id, parsedItems);

    // Add participants with amount=0 (will be calculated after item selection)
    const participantData = participantIds.map((userId: string) => ({
      userId,
      amount: 0,
    }));
    addParticipantsBulk(bill.id, participantData);

    const participants = getParticipantsByBill(bill.id);
    const freshBill = getBillById(bill.id)!;

    // Post bill card in channel (pending state)
    const result = await client.chat.postMessage({
      channel: channelId,
      blocks: buildBillCard(freshBill, participants, billItems),
      text: `New bill: ${billName} - ${totalAmount} (waiting for item selections)`,
    });

    if (result.ts) {
      updateBillMessageTs(bill.id, result.ts);
    }

    // DM each participant with item selection checklist
    for (const userId of participantIds) {
      try {
        await client.chat.postMessage({
          channel: userId,
          blocks: buildItemSelectDM(
            billName,
            creatorId,
            bill.id,
            billItems,
            freshBill.currency
          ),
          text: `Select your items for "${billName}"`,
        });
      } catch (err) {
        console.error(
          `Failed to send item selection DM to ${userId}:`,
          err
        );
      }
    }
  }
});

// ── Mark as Paid Modal Submission ─────────────────
app.view("mark_paid_modal", async ({ ack, view, client, body }) => {
  await ack();

  const metadata = JSON.parse(view.private_metadata);
  const { billId, participantId, channelId } = metadata;

  const bill = getBillById(billId);
  const participant = getParticipantById(participantId);
  if (!bill || !participant) return;

  const userId = body.user.id;

  // Update participant status to pending (waiting for creator confirmation)
  updateParticipantStatus(participantId, "pending");

  // Check if a payment slip was uploaded
  const slipData = view.state.values.payment_slip?.payment_slip_input;
  const files = (slipData as any)?.files as
    | { id: string; name: string; permalink: string; filetype: string }[]
    | undefined;
  const slipFile = files && files.length > 0 ? files[0] : null;

  // Build creator notification blocks
  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:money_with_wings: <@${userId}> says they paid *${formatCurrency(participant.amount, bill.currency)}* for *${bill.name}*`,
      },
    },
  ];

  // Add payment slip image if uploaded
  if (slipFile) {
    const imageTypes = ["png", "jpg", "jpeg", "heic", "gif"];
    if (imageTypes.includes(slipFile.filetype)) {
      blocks.push({
        type: "image",
        slack_file: { id: slipFile.id },
        alt_text: "Payment slip",
      });
    } else {
      // Non-image file (e.g., PDF) — show as a link
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:paperclip: <${slipFile.permalink}|${slipFile.name}>`,
        },
      });
    }
  }

  blocks.push({
    type: "actions",
    block_id: `confirm_payment_${participantId}`,
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Confirm Payment" },
        style: "primary",
        action_id: "confirm_payment",
        value: JSON.stringify({ participantId, billId }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Reject" },
        style: "danger",
        action_id: "reject_payment",
        value: JSON.stringify({ participantId, billId }),
      },
    ],
  });

  // Send DM to creator
  await client.chat.postMessage({
    channel: bill.creator_id,
    blocks,
    text: `${userId} says they paid for ${bill.name}. Confirm?`,
  });

  // Notify the participant via ephemeral in the channel
  try {
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: `:hourglass_flowing_sand: Payment notification sent to <@${bill.creator_id}> for confirmation.`,
    });
  } catch {
    // Ephemeral may fail if the channel context is unavailable (e.g., modal opened from DM)
  }
});

// ── Button Actions ────────────────────────────────
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
