import type { App } from "@slack/bolt";
import { getBillById } from "../models/bill";
import { getUnpaidParticipantsByBill } from "../models/participant";
import { buildReminderDM } from "../views/reminderMessage";
import { buildResultModal } from "../views/resultModal";

export function registerRemindAllAction(app: App): void {
  app.action("remind_all", async ({ ack, body, client, action }) => {
    await ack();

    const billId = (action as any).value;
    const userId = body.user.id;
    const bill = getBillById(billId);
    const isFromModal = !!(body as any).view;
    const channelId = (body as any).channel?.id || bill?.channel_id || "";

    if (!bill || bill.status !== "active") {
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

    // Only creator can send reminders
    if (bill.creator_id !== userId) {
      if (isFromModal) {
        await client.views.update({
          view_id: (body as any).view.id,
          view: buildResultModal(":x: Only the bill creator can send reminders."),
        });
      } else {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "Only the bill creator can send reminders.",
        });
      }
      return;
    }

    const unpaidParticipants = getUnpaidParticipantsByBill(billId);

    if (unpaidParticipants.length === 0) {
      if (isFromModal) {
        await client.views.update({
          view_id: (body as any).view.id,
          view: buildResultModal(":white_check_mark: Everyone has already paid!"),
        });
      } else {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "Everyone has already paid!",
        });
      }
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

    const resultText = `:bell: Reminders sent to ${sentCount} participant(s).`;
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
