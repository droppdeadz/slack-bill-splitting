import type { App } from "@slack/bolt";
import { getBillById, updateBillStatus } from "../models/bill";
import {
  updateParticipantStatus,
  getParticipantsByBill,
  areAllParticipantsPaid,
  getParticipantById,
} from "../models/participant";
import { getItemsByBill } from "../models/billItem";
import { getItemBreakdownsByParticipant } from "../models/itemSelection";
import { getPaymentMethodByUser } from "../models/paymentMethod";
import { buildBillCard } from "../views/billCard";

export function registerConfirmPaymentAction(app: App): void {
  // Confirm payment
  app.action("confirm_payment", async ({ ack, body, client, action }) => {
    await ack();

    const { participantId, billId } = JSON.parse((action as any).value);
    const participant = getParticipantById(participantId);
    const bill = getBillById(billId);

    if (!bill || !participant) return;

    // Mark as paid
    updateParticipantStatus(participantId, "paid");

    // Check if all participants have paid
    if (areAllParticipantsPaid(billId)) {
      updateBillStatus(billId, "completed");
    }

    // Update the original bill card in the channel
    const updatedBill = getBillById(billId)!;
    const participants = getParticipantsByBill(billId);
    const items = getItemsByBill(billId);
    const breakdowns = updatedBill.split_type === "item"
      ? getItemBreakdownsByParticipant(billId)
      : undefined;
    const creatorPm = getPaymentMethodByUser(updatedBill.creator_id);

    if (updatedBill.message_ts) {
      await client.chat.update({
        channel: updatedBill.channel_id,
        ts: updatedBill.message_ts,
        blocks: buildBillCard(updatedBill, participants, items, breakdowns, creatorPm),
        text: `Bill updated: ${updatedBill.name}`,
      });
    }

    // Update the confirmation message
    await client.chat.update({
      channel: body.channel?.id || body.user.id,
      ts: (body as any).message.ts,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:white_check_mark: Payment confirmed for <@${participant.user_id}> on *${bill.name}*`,
          },
        },
      ],
      text: `Payment confirmed for ${bill.name}`,
    });

    // Notify the participant
    await client.chat.postMessage({
      channel: participant.user_id,
      text: `:white_check_mark: Your payment for *${bill.name}* has been confirmed by <@${bill.creator_id}>!`,
    });
  });

  // Reject payment
  app.action("reject_payment", async ({ ack, body, client, action }) => {
    await ack();

    const { participantId, billId } = JSON.parse((action as any).value);
    const participant = getParticipantById(participantId);
    const bill = getBillById(billId);

    if (!bill || !participant) return;

    // Revert to unpaid
    updateParticipantStatus(participantId, "unpaid");

    // Update the confirmation message
    await client.chat.update({
      channel: body.channel?.id || body.user.id,
      ts: (body as any).message.ts,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:x: Payment rejected for <@${participant.user_id}> on *${bill.name}*`,
          },
        },
      ],
      text: `Payment rejected for ${bill.name}`,
    });

    // Notify the participant
    await client.chat.postMessage({
      channel: participant.user_id,
      text: `:x: Your payment for *${bill.name}* was not confirmed by <@${bill.creator_id}>. Please check with them.`,
    });
  });
}
