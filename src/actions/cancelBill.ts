import type { App } from "@slack/bolt";
import { getBillById, updateBillStatus } from "../models/bill";
import { getParticipantsByBill } from "../models/participant";
import { getItemsByBill } from "../models/billItem";
import { getItemBreakdownsByParticipant } from "../models/itemSelection";
import { buildBillCard } from "../views/billCard";

export function registerCancelBillAction(app: App): void {
  app.action("cancel_bill", async ({ ack, body, client, action }) => {
    await ack();

    const billId = (action as any).value;
    const userId = body.user.id;
    const bill = getBillById(billId);

    if (!bill || (bill.status !== "active" && bill.status !== "pending")) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "This bill is no longer active.",
      });
      return;
    }

    // Only creator can cancel
    if (bill.creator_id !== userId) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "Only the bill creator can cancel this bill.",
      });
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

    await client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      text: `:no_entry_sign: Bill "${bill.name}" has been cancelled.`,
    });
  });
}
