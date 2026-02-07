import { types } from "@slack/bolt";
type KnownBlock = types.KnownBlock;

import type { PaymentMethod } from "../models/paymentMethod";
import { formatCurrency } from "../utils/formatCurrency";

export function buildPromptPayQrBlocks(
  amount: number,
  currency: string,
  billName: string
): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Pay via PromptPay" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${billName}*\nAmount: *${formatCurrency(amount, currency)}*\n\nScan the QR code below with your banking app:`,
      },
    },
  ];
}

export function buildBankInfoBlocks(
  pm: PaymentMethod,
  amount: number,
  currency: string,
  billName: string
): KnownBlock[] {
  const maskedAccount = pm.bank_account_number
    ? "••••" + pm.bank_account_number.slice(-4)
    : "N/A";

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Payment Info" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${billName}*\nAmount: *${formatCurrency(amount, currency)}*`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Bank:* ${pm.bank_name}`,
          `*Account:* \`${maskedAccount}\``,
          ...(pm.bank_account_name
            ? [`*Name:* ${pm.bank_account_name}`]
            : []),
        ].join("\n"),
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Transfer to this account, then click *Mark as Paid* on the bill card.",
        },
      ],
    },
  ];
}
