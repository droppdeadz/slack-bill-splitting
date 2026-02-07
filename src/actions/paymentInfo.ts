import type { App } from "@slack/bolt";
import { getBillById } from "../models/bill";
import {
  getParticipantByBillAndUser,
} from "../models/participant";
import {
  getPaymentMethodByUser,
  hasPromptPay,
  hasBankAccount,
} from "../models/paymentMethod";
import { generatePromptPayQr } from "../services/promptPayQr";
import {
  buildPromptPayQrBlocks,
  buildBankInfoBlocks,
} from "../views/paymentInfoMessage";

export function registerPaymentInfoAction(app: App): void {
  // "Pay via PromptPay" button handler
  app.action(
    "pay_via_promptpay",
    async ({ ack, body, client, action }) => {
      await ack();

      const billId = (action as any).value;
      const userId = body.user.id;
      const channelId = body.channel?.id || "";
      const bill = getBillById(billId);

      if (!bill || bill.status !== "active") {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "This bill is no longer active.",
        });
        return;
      }

      // Creator clicks their own button
      if (bill.creator_id === userId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "You're the bill owner — no need to pay yourself!",
        });
        return;
      }

      const participant = getParticipantByBillAndUser(billId, userId);
      if (!participant) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "You are not a participant of this bill.",
        });
        return;
      }

      if (participant.status === "paid") {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "You have already been marked as paid for this bill.",
        });
        return;
      }

      const pm = getPaymentMethodByUser(bill.creator_id);
      if (!pm || !hasPromptPay(pm)) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "The bill creator has not set up PromptPay.",
        });
        return;
      }

      try {
        // Generate QR code
        const qrBuffer = await generatePromptPayQr(
          pm.promptpay_id!,
          participant.amount
        );

        // Open a DM with the user so we can upload the QR image there
        const dm = await client.conversations.open({ users: userId });
        const dmChannelId = (dm as any).channel?.id;
        if (!dmChannelId) throw new Error("Could not open DM");

        // Upload QR image to the DM channel
        const upload = await client.filesUploadV2({
          channel_id: dmChannelId,
          file: qrBuffer,
          filename: `promptpay_${billId.slice(0, 8)}.png`,
          title: `PromptPay QR — ${bill.name}`,
          initial_comment: [
            `*Pay via PromptPay*`,
            `*${bill.name}* — *${participant.amount.toLocaleString()} ${bill.currency}*`,
            `Scan the QR code with your banking app, then click *Mark as Paid* on the bill card.`,
          ].join("\n"),
        });

        // Let the user know in the original channel
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: `PromptPay QR for *${bill.name}* has been sent to your DMs.`,
        });
      } catch (err) {
        console.error("Failed to generate PromptPay QR:", err);
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "Failed to generate PromptPay QR code. Please try again later.",
        });
      }
    }
  );

  // "Payment Info" button handler (bank account details)
  app.action(
    "payment_info",
    async ({ ack, body, client, action }) => {
      await ack();

      const billId = (action as any).value;
      const userId = body.user.id;
      const channelId = body.channel?.id || "";
      const bill = getBillById(billId);

      if (!bill || bill.status !== "active") {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "This bill is no longer active.",
        });
        return;
      }

      // Creator clicks their own button
      if (bill.creator_id === userId) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "You're the bill owner — no need to pay yourself!",
        });
        return;
      }

      const participant = getParticipantByBillAndUser(billId, userId);
      if (!participant) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "You are not a participant of this bill.",
        });
        return;
      }

      if (participant.status === "paid") {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "You have already been marked as paid for this bill.",
        });
        return;
      }

      const pm = getPaymentMethodByUser(bill.creator_id);
      if (!pm || !hasBankAccount(pm)) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: "The bill creator has not set up bank account details.",
        });
        return;
      }

      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        blocks: buildBankInfoBlocks(
          pm,
          participant.amount,
          bill.currency,
          bill.name,
          billId
        ),
        text: `Payment info for ${bill.name}`,
      });
    }
  );

  // "Copy Account No." button handler — opens a modal for easy copying
  app.action(
    "copy_bank_account",
    async ({ ack, body, client, action }) => {
      await ack();

      const billId = (action as any).value;
      const bill = getBillById(billId);
      if (!bill) return;

      const pm = getPaymentMethodByUser(bill.creator_id);
      if (!pm?.bank_account_number) return;

      await client.views.open({
        trigger_id: (body as any).trigger_id,
        view: {
          type: "modal",
          title: { type: "plain_text", text: "Bank Account Number" },
          close: { type: "plain_text", text: "Done" },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${pm.bank_name}*${pm.bank_account_name ? `\n${pm.bank_account_name}` : ""}`,
              },
            },
            { type: "divider" },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `\`\`\`${pm.bank_account_number}\`\`\``,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "Long-press or select the number above to copy it.",
                },
              ],
            },
          ],
        },
      });
    }
  );
}
