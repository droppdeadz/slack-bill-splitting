import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { getBillById, updateBillStatus } from "../models/bill";
import {
  getParticipantsByBill,
  haveAllParticipantsSelected,
  updateParticipantAmount,
  updateParticipantStatus,
  areAllParticipantsPaid,
} from "../models/participant";
import { getItemsByBill } from "../models/billItem";
import { getItemSplitForBill } from "../models/itemSelection";
import { getPaymentMethodByUser } from "../models/paymentMethod";
import { buildBillCard, formatUnselectedItems } from "../views/billCard";

// "complete_calculation" is the legacy action_id still present on cards posted
// before the rename to Finalize Shares.
const FINALIZE_SHARES_ACTION = /^(finalize_shares|complete_calculation)$/;

export function registerFinalizeSharesAction(app: App): void {
  app.action<BlockAction<ButtonAction>>(
    FINALIZE_SHARES_ACTION,
    async ({ ack, body, client, action }) => {
      await ack();

      const billId = action.value ?? "";
      const userId = body.user.id;
      const bill = getBillById(billId);

      if (bill?.status !== "awaiting_selection") {
        await client.chat.postEphemeral({
          channel: body.channel?.id || "",
          user: userId,
          text: "This bill is no longer awaiting item selections.",
        });
        return;
      }

      // Only creator can finalize
      if (bill.creator_id !== userId) {
        await client.chat.postEphemeral({
          channel: body.channel?.id || "",
          user: userId,
          text: "Only the bill creator can finalize shares.",
        });
        return;
      }

      // Verify all participants have selected
      if (!haveAllParticipantsSelected(billId)) {
        await client.chat.postEphemeral({
          channel: body.channel?.id || "",
          user: userId,
          text: "Not all participants have completed their item selection yet.",
        });
        return;
      }

      // Turn Selections into Shares (Creator absorbs Unselected Items + rounding)
      const split = getItemSplitForBill(billId);
      const participants = getParticipantsByBill(billId);
      for (const participant of participants) {
        updateParticipantAmount(participant.id, split.shares.get(participant.id) ?? 0);
      }

      // Auto-mark creator as paid (the Creator paid upfront)
      const creatorParticipant = participants.find(
        (p) => p.user_id === bill.creator_id
      );
      if (creatorParticipant) {
        updateParticipantStatus(creatorParticipant.id, "paid");
      }

      // Move bill to active status (or completed if all paid)
      if (areAllParticipantsPaid(billId)) {
        updateBillStatus(billId, "completed");
      } else {
        updateBillStatus(billId, "active");
      }

      // Refresh data and update the bill card
      const updatedBill = getBillById(billId);
      if (!updatedBill) return;
      const updatedParticipants = getParticipantsByBill(billId);
      const items = getItemsByBill(billId);
      const creatorPm = getPaymentMethodByUser(bill.creator_id);

      if (updatedBill.message_ts) {
        await client.chat.update({
          channel: updatedBill.channel_id,
          ts: updatedBill.message_ts,
          blocks: buildBillCard(updatedBill, updatedParticipants, items, split.breakdowns, creatorPm),
          text: `Shares finalized: ${updatedBill.name}`,
        });
      }

      const unselectedNote =
        split.unselectedItems.length > 0
          ? `\nNobody selected ${formatUnselectedItems(split.unselectedItems, bill.currency)} — added to your share.`
          : "";

      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: `:white_check_mark: Shares for "${bill.name}" are finalized! Payment tracking is now active.${unselectedNote}`,
      });
    }
  );
}
