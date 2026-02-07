import type { App } from "@slack/bolt";
import { getBillById, updateBillStatus } from "../models/bill";
import { getParticipantsByBill } from "../models/participant";
import { getItemsByBill } from "../models/billItem";
import { getItemBreakdownsByParticipant } from "../models/itemSelection";
import { buildBillCard } from "../views/billCard";

function buildResultModal(message: string) {
  return {
    type: "modal" as const,
    title: { type: "plain_text" as const, text: "Manage Bill" },
    close: { type: "plain_text" as const, text: "Close" },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: message },
      },
    ],
  };
}

export function registerCancelBillAction(app: App): void {
  app.action("cancel_bill", async ({ ack, body, client, action }) => {
    await ack();

    const billId = (action as any).value;
    const userId = body.user.id;
    const bill = getBillById(billId);
    const isFromModal = !!(body as any).view;
    const channelId = (body as any).channel?.id || bill?.channel_id || "";

    if (!bill || (bill.status !== "active" && bill.status !== "pending")) {
      if (isFromModal) {
        await client.views.update({
          view_id: (body as any).view.id,
          view: buildResultModal(":x: This bill is no longer active."),
        });
      } else {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "This bill is no longer active.",
        });
      }
      return;
    }

    // Only creator can cancel
    if (bill.creator_id !== userId) {
      if (isFromModal) {
        await client.views.update({
          view_id: (body as any).view.id,
          view: buildResultModal(":x: Only the bill creator can cancel this bill."),
        });
      } else {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "Only the bill creator can cancel this bill.",
        });
      }
      return;
    }

    // Cancel the bill
    updateBillStatus(billId, "cancelled");

    // Update the bill card
    const updatedBill = getBillById(billId)!;
    const participants = getParticipantsByBill(billId);
    const items = getItemsByBill(billId);
    const breakdowns = updatedBill.split_type === "item"
      ? getItemBreakdownsByParticipant(billId)
      : undefined;

    if (updatedBill.message_ts) {
      await client.chat.update({
        channel: updatedBill.channel_id,
        ts: updatedBill.message_ts,
        blocks: buildBillCard(updatedBill, participants, items, breakdowns),
        text: `Bill cancelled: ${updatedBill.name}`,
      });
    }

    const resultText = `:no_entry_sign: Bill "${bill.name}" has been cancelled.`;
    if (isFromModal) {
      await client.views.update({
        view_id: (body as any).view.id,
        view: buildResultModal(resultText),
      });
    } else {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: resultText,
      });
    }
  });
}
