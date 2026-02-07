import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { types } from "@slack/bolt";
type KnownBlock = types.KnownBlock;
import { getBillById } from "../models/bill";

export function registerManageBillAction(app: App): void {
  app.action<BlockAction<ButtonAction>>("manage_bill", async ({ ack, body, client, action }) => {
    await ack();

    const billId = action.value ?? "";
    const userId = body.user.id;
    const bill = getBillById(billId);

    if (bill?.status !== "active" && bill?.status !== "pending") {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "This bill is no longer active.",
      });
      return;
    }

    // Only creator can manage the bill
    if (bill.creator_id !== userId) {
      await client.chat.postEphemeral({
        channel: body.channel?.id || "",
        user: userId,
        text: "Only the bill creator can manage this bill.",
      });
      return;
    }

    // Build modal blocks based on bill status
    const modalBlocks: KnownBlock[] = [];

    if (bill.status === "active") {
      modalBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":bell: *Send Reminders*\nSend DM reminders to all unpaid participants.",
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Remind All" },
          action_id: "remind_all",
          value: bill.id,
        },
      }, { type: "divider" });
    }

    modalBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":no_entry_sign: *Cancel Bill*\nPermanently cancel this bill. This cannot be undone.",
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Cancel Bill" },
        style: "danger",
        action_id: "cancel_bill",
        value: bill.id,
      },
    });

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Manage Bill" },
        close: { type: "plain_text", text: "Close" },
        blocks: modalBlocks,
      },
    });
  });
}
