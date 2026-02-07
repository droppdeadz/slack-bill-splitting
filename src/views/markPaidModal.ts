import { types } from "@slack/bolt";
type View = types.View;
type KnownBlock = types.KnownBlock;

import { formatCurrency } from "../utils/formatCurrency";

interface MarkPaidModalOptions {
  billId: string;
  billName: string;
  participantId: string;
  channelId: string;
  amount: number;
  currency: string;
}

export function buildMarkPaidModal(options: MarkPaidModalOptions): View {
  const { billId, billName, participantId, channelId, amount, currency } =
    options;

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:receipt: *${billName}*\nYour share: *${formatCurrency(amount, currency)}*`,
      },
    },
    { type: "divider" },
    {
      type: "input",
      block_id: "payment_slip",
      optional: true,
      label: {
        type: "plain_text",
        text: "Payment Slip (optional)",
      },
      hint: {
        type: "plain_text",
        text: "Upload a screenshot or photo of your payment. You can skip this if you paid with cash.",
      },
      element: {
        type: "file_input",
        action_id: "payment_slip_input",
        filetypes: ["png", "jpg", "jpeg", "heic", "pdf"],
        max_files: 1,
      } as any,
    },
  ];

  return {
    type: "modal",
    callback_id: "mark_paid_modal",
    title: {
      type: "plain_text",
      text: "Mark as Paid",
    },
    submit: {
      type: "plain_text",
      text: "Submit",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    private_metadata: JSON.stringify({ billId, participantId, channelId }),
    blocks,
  };
}
