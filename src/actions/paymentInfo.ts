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

        // Upload QR image to Slack
        const upload = await client.filesUploadV2({
          channel_id: channelId,
          file: qrBuffer,
          filename: `promptpay_${billId.slice(0, 8)}.png`,
          title: `PromptPay QR — ${bill.name}`,
        });

        // Get the file ID from the upload response
        const fileId = (upload as any).file?.id;

        // Build blocks with QR info
        const blocks = buildPromptPayQrBlocks(
          participant.amount,
          bill.currency,
          bill.name
        );

        // Add the QR image block if upload succeeded
        if (fileId) {
          blocks.push({
            type: "image",
            slack_file: { id: fileId },
            alt_text: "PromptPay QR Code",
          } as any);
        }

        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "After paying, click *Mark as Paid* on the bill card.",
            },
          ],
        });

        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          blocks,
          text: `PromptPay QR for ${bill.name}`,
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
          bill.name
        ),
        text: `Payment info for ${bill.name}`,
      });
    }
  );
}
