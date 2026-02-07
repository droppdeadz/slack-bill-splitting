import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { getBillById } from "../models/bill";
import { getUnpaidParticipantsByBill } from "../models/participant";
import { buildReminderDM } from "../views/reminderMessage";
import { buildResultModal } from "../views/resultModal";

async function respond(
  client: Parameters<Parameters<App["action"]>[1]>[0]["client"],
  isFromModal: boolean,
  viewId: string,
  channelId: string,
  userId: string,
  text: string
): Promise<void> {
  if (isFromModal) {
    await client.views.update({ view_id: viewId, view: buildResultModal(text) });
  } else {
    await client.chat.postEphemeral({ channel: channelId, user: userId, text });
  }
}

export function registerRemindAllAction(app: App): void {
  app.action<BlockAction<ButtonAction>>("remind_all", async ({ ack, body, client, action }) => {
    await ack();

    const billId = action.value ?? "";
    const userId = body.user.id;
    const bill = getBillById(billId);
    const isFromModal = !!body.view;
    const viewId = body.view?.id ?? "";
    const channelId = body.channel?.id || bill?.channel_id || "";

    if (bill?.status !== "active") {
      await respond(client, isFromModal, viewId, channelId, userId, ":x: This bill is no longer active.");
      return;
    }

    if (bill.creator_id !== userId) {
      await respond(client, isFromModal, viewId, channelId, userId, ":x: Only the bill creator can send reminders.");
      return;
    }

    const unpaidParticipants = getUnpaidParticipantsByBill(billId);

    if (unpaidParticipants.length === 0) {
      await respond(client, isFromModal, viewId, channelId, userId, ":white_check_mark: Everyone has already paid!");
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

    await respond(client, isFromModal, viewId, channelId, userId, `:bell: Reminders sent to ${sentCount} participant(s).`);
  });
}
