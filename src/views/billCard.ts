import { types } from "@slack/bolt";
type KnownBlock = types.KnownBlock;
import type { Bill } from "../models/bill";
import type { Participant } from "../models/participant";
import { formatCurrency, progressBar } from "../utils/formatCurrency";

export function buildBillCard(
  bill: Bill,
  participants: Participant[]
): KnownBlock[] {
  const paidAmount = participants
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const splitLabel =
    bill.split_type === "equal"
      ? `Split equally (${participants.length} people)`
      : "Custom split";

  const statusEmoji: Record<string, string> = {
    paid: ":white_check_mark:",
    pending: ":hourglass_flowing_sand:",
    unpaid: ":red_circle:",
  };

  const participantLines = participants
    .map((p) => {
      const emoji = statusEmoji[p.status];
      const statusText =
        p.status.charAt(0).toUpperCase() + p.status.slice(1);
      return `${emoji}  <@${p.user_id}>    ${formatCurrency(p.amount, bill.currency)}    _${statusText}_`;
    })
    .join("\n");

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${bill.name}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Total: ${formatCurrency(bill.total_amount, bill.currency)}*\nCreated by <@${bill.creator_id}> | ${splitLabel}`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: participantLines,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Collected:* ${formatCurrency(paidAmount, bill.currency)} / ${formatCurrency(bill.total_amount, bill.currency)}\n\`${progressBar(paidAmount, bill.total_amount)}\``,
      },
    },
  ];

  // Add action buttons only for active bills
  if (bill.status === "active") {
    blocks.push({
      type: "actions",
      block_id: `bill_actions_${bill.id}`,
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Mark as Paid" },
          style: "primary",
          action_id: "mark_paid",
          value: bill.id,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Remind All" },
          action_id: "remind_all",
          value: bill.id,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Cancel Bill" },
          style: "danger",
          action_id: "cancel_bill",
          value: bill.id,
        },
      ],
    });
  } else {
    const statusLabel =
      bill.status === "completed"
        ? ":tada: *All paid! Bill completed.*"
        : ":no_entry_sign: *Bill cancelled.*";
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: statusLabel },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Bill ID: \`${bill.id.slice(0, 8)}\` | Created: <!date^${Math.floor(new Date(bill.created_at).getTime() / 1000)}^{date_short} at {time}|${bill.created_at}>`,
      },
    ],
  });

  return blocks;
}
