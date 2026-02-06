import { types } from "@slack/bolt";
type KnownBlock = types.KnownBlock;
import { formatCurrency } from "../utils/formatCurrency";

export function buildReminderDM(
  billName: string,
  amount: number,
  currency: string,
  creatorId: string,
  channelId: string,
  billId: string
): KnownBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:bell: *Reminder: You owe ${formatCurrency(amount, currency)}*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Bill:* ${billName}\n*Amount:* ${formatCurrency(amount, currency)}\n*Created by:* <@${creatorId}>\n*Channel:* <#${channelId}>`,
      },
    },
    {
      type: "actions",
      block_id: `reminder_actions_${billId}`,
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Mark as Paid" },
          style: "primary",
          action_id: "mark_paid",
          value: billId,
        },
      ],
    },
  ];
}

export function buildOutstandingSummary(
  bills: {
    bill_name: string;
    amount: number;
    creator_id: string;
    channel_id: string;
  }[],
  currency: string
): KnownBlock[] {
  const totalOwed = bills.reduce((sum, b) => sum + b.amount, 0);

  const billLines = bills
    .map(
      (b) =>
        `- *${b.bill_name}* — ${formatCurrency(b.amount, currency)} (by <@${b.creator_id}> in <#${b.channel_id}>)`
    )
    .join("\n");

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Your Outstanding Bills",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `You have *${bills.length} unpaid bill(s)* totaling *${formatCurrency(totalOwed, currency)}*`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: billLines || "_No outstanding bills!_",
      },
    },
  ];
}
