import type { App } from "@slack/bolt";
import { getBillById, updateBillStatus } from "../models/bill";
import {
  getParticipantsByBill,
  haveAllParticipantsSelected,
  updateParticipantAmount,
  updateParticipantStatus,
  areAllParticipantsPaid,
} from "../models/participant";
import { getItemsByBill } from "../models/billItem";
import { getAllSelectionsByBill, getItemBreakdownsByParticipant } from "../models/itemSelection";
import { buildBillCard } from "../views/billCard";
import { calculateItemSplits } from "../utils/splitCalculator";

export function registerCompleteCalcAction(app: App): void {
  app.action(
    "complete_calculation",
    async ({ ack, body, client, action }) => {
      await ack();

      const billId = (action as any).value;
      const userId = body.user.id;
      const bill = getBillById(billId);

      if (!bill || bill.status !== "pending") {
        await client.chat.postEphemeral({
          channel: body.channel?.id || "",
          user: userId,
          text: "This bill is not in pending status.",
        });
        return;
      }

      // Only creator can finalize
      if (bill.creator_id !== userId) {
        await client.chat.postEphemeral({
          channel: body.channel?.id || "",
          user: userId,
          text: "Only the bill creator can finalize the calculation.",
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

      // Calculate per-person amounts from item selections
      const items = getItemsByBill(billId);
      const participants = getParticipantsByBill(billId);

      // Get all selections for this bill
      const allSelections = getAllSelectionsByBill(billId);

      const participantTotals = calculateItemSplits(items, allSelections);

      // Update each participant's amount
      for (const participant of participants) {
        const amount = participantTotals.get(participant.id) || 0;
        updateParticipantAmount(participant.id, amount);
      }

      // Auto-mark creator as paid (bill owner paid upfront)
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
      const updatedBill = getBillById(billId)!;
      const updatedParticipants = getParticipantsByBill(billId);
      const breakdowns = getItemBreakdownsByParticipant(billId);

      if (updatedBill.message_ts) {
        await client.chat.update({
          channel: updatedBill.channel_id,
          ts: updatedBill.message_ts,
          blocks: buildBillCard(updatedBill, updatedParticipants, items, breakdowns),
          text: `Bill finalized: ${updatedBill.name}`,
        });
      }

      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: `:white_check_mark: Bill "${bill.name}" has been finalized! Payment tracking is now active.`,
      });
    }
  );
}
