import type { App } from "@slack/bolt";
import { getBillById } from "../models/bill";
import {
  getParticipantByBillAndUser,
  updateParticipantStatus,
  getParticipantsByBill,
} from "../models/participant";
import { formatCurrency } from "../utils/formatCurrency";

export function registerMarkPaidAction(app: App): void {
  app.action("mark_paid", async ({ ack, body, client, action }) => {
    await ack();

    const billId = (action as any).value;
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

    // Mark as pending (waiting for creator confirmation)
    updateParticipantStatus(participant.id, "pending");

    // Notify creator to confirm
    await client.chat.postMessage({
      channel: bill.creator_id,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:money_with_wings: <@${userId}> says they paid *${formatCurrency(participant.amount, bill.currency)}* for *${bill.name}*`,
          },
        },
        {
          type: "actions",
          block_id: `confirm_payment_${participant.id}`,
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Confirm Payment" },
              style: "primary",
              action_id: "confirm_payment",
              value: JSON.stringify({
                participantId: participant.id,
                billId: bill.id,
              }),
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Reject" },
              style: "danger",
              action_id: "reject_payment",
              value: JSON.stringify({
                participantId: participant.id,
                billId: bill.id,
              }),
            },
          ],
        },
      ],
      text: `${userId} says they paid for ${bill.name}. Confirm?`,
    });

    // Notify the user
    await client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      text: `:hourglass_flowing_sand: Payment notification sent to <@${bill.creator_id}> for confirmation.`,
    });
  });
}
