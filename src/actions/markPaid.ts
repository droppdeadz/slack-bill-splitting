import type { App } from "@slack/bolt";
import { getBillById } from "../models/bill";
import { getParticipantByBillAndUser } from "../models/participant";
import { buildMarkPaidModal } from "../views/markPaidModal";

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

    // Open modal for optional payment slip upload
    await client.views.open({
      trigger_id: (body as any).trigger_id,
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
}
