import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { types } from "@slack/bolt";
type KnownBlock = types.KnownBlock;
import { getBillById } from "../models/bill";
import {
  getParticipantById,
  getParticipantByBillAndUser,
  updateParticipantStatus,
} from "../models/participant";
import { buildMarkPaidModal } from "../views/markPaidModal";
import { formatCurrency } from "../utils/formatCurrency";
import { trackBillFile } from "../models/billFile";

export function registerMarkPaidAction(app: App): void {
  // "Mark as Paid" button handler
  app.action<BlockAction<ButtonAction>>("mark_paid", async ({ ack, body, client, action }) => {
    await ack();

    const billId = action.value ?? "";
    const userId = body.user.id;
    const bill = getBillById(billId);

    if (!bill || bill.status !== "active") {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "This bill is no longer active.",
      });
      return;
    }

    // Bill owner doesn't need to mark as paid (they paid upfront)
    if (bill.creator_id === userId) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "You're the bill owner — no need to mark as paid!",
      });
      return;
    }

    const participant = getParticipantByBillAndUser(billId, userId);

    if (!participant) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "You are not a participant of this bill.",
      });
      return;
    }

    if (participant.status === "paid") {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "You have already been marked as paid for this bill.",
      });
      return;
    }

    // Open modal for optional payment slip upload
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildMarkPaidModal({
        billId: bill.id,
        billName: bill.name,
        participantId: participant.id,
        channelId: body.channel?.id || bill.channel_id,
        amount: participant.amount,
        currency: bill.currency,
      }),
    });
  });

  // Mark as Paid modal submission handler
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
    const slipDataWithFiles = slipData as typeof slipData & { files?: { id: string; name: string; permalink: string; filetype: string }[] };
    const files = slipDataWithFiles?.files;
    const slipFile = files && files.length > 0 ? files[0] : null;

    // Track payment slip file for cleanup
    if (slipFile) {
      trackBillFile(billId, slipFile.id, "payment_slip", userId);
    }

    // Build creator notification blocks
    const blocks: KnownBlock[] = [
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
    } catch (_err: unknown) {
      // Ephemeral may fail if the channel context is unavailable (e.g., modal opened from DM)
    }
  });
}

