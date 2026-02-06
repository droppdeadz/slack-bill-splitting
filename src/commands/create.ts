import type { App } from "@slack/bolt";
import { buildCreateBillModal } from "../views/createBillModal";
import { createBill } from "../models/bill";
import { addParticipantsBulk, getParticipantsByBill } from "../models/participant";
import { updateBillMessageTs, getBillById } from "../models/bill";
import { buildBillCard } from "../views/billCard";
import { splitEqual } from "../utils/splitCalculator";

export function registerCreateCommand(app: App): void {
  // Handle /copter create -> open modal
  app.command("/copter", async ({ command, ack, client, body }) => {
    await ack();

    const subcommand = command.text.trim().split(/\s+/)[0];

    if (subcommand === "create" || subcommand === "") {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          ...buildCreateBillModal(),
          private_metadata: JSON.stringify({
            channel_id: command.channel_id,
          }),
        },
      });
    }
  });

  // Handle modal submission
  app.view("create_bill_modal", async ({ ack, view, client, body }) => {
    const values = view.state.values;
    const billName = values.bill_name.bill_name_input.value!;
    const totalAmountStr = values.total_amount.total_amount_input.value!;
    const splitType = values.split_type.split_type_input.selected_option!.value as "equal" | "custom";
    const participantIds = values.participants.participants_input.selected_users!;

    const totalAmount = parseFloat(totalAmountStr);

    // Validate amount
    if (isNaN(totalAmount) || totalAmount <= 0) {
      await ack({
        response_action: "errors",
        errors: {
          total_amount: "Please enter a valid positive number",
        },
      });
      return;
    }

    if (participantIds.length === 0) {
      await ack({
        response_action: "errors",
        errors: {
          participants: "Please select at least one participant",
        },
      });
      return;
    }

    await ack();

    const metadata = JSON.parse(view.private_metadata);
    const channelId = metadata.channel_id;
    const creatorId = body.user.id;

    // Create the bill
    const bill = createBill({
      name: billName,
      totalAmount,
      splitType,
      creatorId,
      channelId,
    });

    // Calculate splits
    const amounts = splitEqual(totalAmount, participantIds.length);
    const participantData = participantIds.map((userId, i) => ({
      userId,
      amount: amounts[i],
    }));

    addParticipantsBulk(bill.id, participantData);

    // Post bill card to channel
    const participants = getParticipantsByBill(bill.id);
    const freshBill = getBillById(bill.id)!;

    const result = await client.chat.postMessage({
      channel: channelId,
      blocks: buildBillCard(freshBill, participants),
      text: `New bill: ${billName} - ${totalAmount}`,
    });

    // Store message_ts for future updates
    if (result.ts) {
      updateBillMessageTs(bill.id, result.ts);
    }
  });
}
