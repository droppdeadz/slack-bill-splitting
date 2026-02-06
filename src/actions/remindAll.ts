import type { App } from "@slack/bolt";
import { getBillById } from "../models/bill";
import { getUnpaidParticipantsByBill } from "../models/participant";
import { buildReminderDM } from "../views/reminderMessage";

export function registerRemindAllAction(app: App): void {
  app.action("remind_all", async ({ ack, body, client, action }) => {
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

    // Only creator can send reminders
    if (bill.creator_id !== userId) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "Only the bill creator can send reminders.",
      });
      return;
    }

    const unpaidParticipants = getUnpaidParticipantsByBill(billId);

    if (unpaidParticipants.length === 0) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "Everyone has already paid!",
      });
      return;
    }

    // Send DM to each unpaid participant
    let sentCount = 0;
    for (const participant of unpaidParticipants) {
      try {
        await client.chat.postMessage({
          channel: participant.user_id,
          blocks: buildReminderDM(
            bill.name,
            participant.amount,
            bill.currency,
            bill.creator_id,
            bill.channel_id,
            bill.id
          ),
          text: `Reminder: You owe ${participant.amount} for ${bill.name}`,
        });
        sentCount++;
      } catch (err) {
        console.error(
          `Failed to send reminder to ${participant.user_id}:`,
          err
        );
      }
    }

    await client.chat.postEphemeral({
      channel: body.channel?.id || "",
      user: userId,
      text: `:bell: Reminders sent to ${sentCount} participant(s).`,
    });
  });
}
