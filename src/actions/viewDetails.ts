import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { getBillById } from "../models/bill";
import { getParticipantsByBill } from "../models/participant";
import { getItemsByBill } from "../models/billItem";
import { getItemBreakdownsByParticipant } from "../models/itemSelection";
import { getPaymentMethodByUser } from "../models/paymentMethod";
import { buildBillCard } from "../views/billCard";

export function registerViewDetailsAction(app: App): void {
  app.action<BlockAction<ButtonAction>>("view_details", async ({ ack, body, client, action }) => {
    await ack();

    const billId = action.value ?? "";
    const userId = body.user.id;
    const bill = getBillById(billId);

    if (!bill) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "Bill not found.",
      });
      return;
    }

    const participants = getParticipantsByBill(billId);
    const items = getItemsByBill(billId);
    const breakdowns = bill.split_type === "item"
      ? getItemBreakdownsByParticipant(billId)
      : undefined;
    const creatorPm = getPaymentMethodByUser(bill.creator_id);

    // Show full bill card as ephemeral to the user
    await client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      blocks: buildBillCard(bill, participants, items, breakdowns, creatorPm),
      text: `Bill details: ${bill.name}`,
    });
  });
}
