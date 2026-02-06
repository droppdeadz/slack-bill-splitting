import type { App } from "@slack/bolt";
import { getBillById } from "../models/bill";
import { getParticipantsByBill } from "../models/participant";
import { buildBillCard } from "../views/billCard";

export function registerViewDetailsAction(app: App): void {
  app.action("view_details", async ({ ack, body, client, action }) => {
    await ack();

    const billId = (action as any).value;
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

    // Show full bill card as ephemeral to the user
    await client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      blocks: buildBillCard(bill, participants),
      text: `Bill details: ${bill.name}`,
    });
  });
}
