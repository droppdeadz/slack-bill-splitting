import type { App } from "@slack/bolt";
import { getBillById } from "../models/bill";
import {
  getParticipantByBillAndUser,
  getParticipantsByBill,
  markParticipantSelected,
  haveAllParticipantsSelected,
} from "../models/participant";
import { getItemsByBill } from "../models/billItem";
import { setSelectionsForParticipant } from "../models/itemSelection";
import { buildBillCard } from "../views/billCard";

export function registerSelectItemsAction(app: App): void {
  // Handle checkbox state changes (just acknowledge, no processing needed)
  app.action("item_checkboxes", async ({ ack }) => {
    await ack();
  });

  // Handle "Confirm Selection" button
  app.action(
    "submit_item_selection",
    async ({ ack, body, client, action }) => {
      await ack();

      const billId = (action as any).value;
      const userId = body.user.id;
      const bill = getBillById(billId);

      if (!bill || bill.status !== "pending") {
        await client.chat.postMessage({
          channel: userId,
          text: "This bill is no longer accepting selections.",
        });
        return;
      }

      const participant = getParticipantByBillAndUser(billId, userId);
      if (!participant) {
        await client.chat.postMessage({
          channel: userId,
          text: "You are not a participant of this bill.",
        });
        return;
      }

      if (participant.has_selected) {
        await client.chat.postMessage({
          channel: userId,
          text: "You have already submitted your selection for this bill.",
        });
        return;
      }

      // Extract selected item IDs from the checkbox state in the message
      const message = (body as any).message;
      const checkboxBlock = message?.blocks?.find(
        (b: any) => b.block_id === `item_select_${billId}`
      );
      const checkboxAction = checkboxBlock?.elements?.find(
        (e: any) => e.action_id === "item_checkboxes"
      );

      // Get currently selected options from the action state
      // In Slack, the state is stored in body.state for block actions
      const stateValues = (body as any).state?.values;
      const selectBlock = stateValues?.[`item_select_${billId}`];
      const selectedOptions =
        selectBlock?.item_checkboxes?.selected_options || [];

      const selectedItemIds: string[] = selectedOptions.map(
        (opt: any) => opt.value
      );

      if (selectedItemIds.length === 0) {
        await client.chat.postMessage({
          channel: userId,
          text: "Please select at least one item before confirming.",
        });
        return;
      }

      // Save selections
      setSelectionsForParticipant(participant.id, selectedItemIds);
      markParticipantSelected(participant.id);

      // Update the DM message to show confirmation
      await client.chat.update({
        channel: body.channel?.id || userId,
        ts: message.ts,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:white_check_mark: Your item selection for *${bill.name}* has been saved! (${selectedItemIds.length} item(s) selected)`,
            },
          },
        ],
        text: `Selection saved for ${bill.name}`,
      });

      // Update the bill card in the channel
      const participants = getParticipantsByBill(billId);
      const items = getItemsByBill(billId);
      const updatedBill = getBillById(billId)!;

      if (updatedBill.message_ts) {
        await client.chat.update({
          channel: updatedBill.channel_id,
          ts: updatedBill.message_ts,
          blocks: buildBillCard(updatedBill, participants, items),
          text: `Bill updated: ${updatedBill.name}`,
        });
      }

      // Check if all participants have selected
      if (haveAllParticipantsSelected(billId)) {
        // Notify the creator
        await client.chat.postMessage({
          channel: bill.creator_id,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:tada: All participants have selected their items for *${bill.name}*!\nGo to <#${bill.channel_id}> and click *Complete Calculation* to finalize the bill.`,
              },
            },
          ],
          text: `All participants have selected items for ${bill.name}`,
        });
      }
    }
  );
}
