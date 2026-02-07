import { types } from "@slack/bolt";
type KnownBlock = types.KnownBlock;
type ActionsBlockElement = types.ActionsBlockElement;
import type { Bill } from "../models/bill";
import type { Participant } from "../models/participant";
import type { BillItem } from "../models/billItem";
import type { PaymentMethod } from "../models/paymentMethod";
import { hasPromptPay, hasBankAccount } from "../models/paymentMethod";
import { formatCurrency, progressBar } from "../utils/formatCurrency";

export interface ItemBreakdown {
  name: string;
  amount: number;
}

export function buildBillCard(
  bill: Bill,
  participants: Participant[],
  items?: BillItem[],
  itemBreakdowns?: Map<string, ItemBreakdown[]>,
  creatorPaymentMethod?: PaymentMethod
): KnownBlock[] {
  if (bill.status === "pending" && bill.split_type === "item") {
    return buildPendingItemCard(bill, participants, items || []);
  }
  return buildActiveCard(bill, participants, itemBreakdowns, items, creatorPaymentMethod);
}

function buildPendingItemCard(
  bill: Bill,
  participants: Participant[],
  items: BillItem[]
): KnownBlock[] {
  const selectedCount = participants.filter((p) => p.has_selected).length;
  const totalCount = participants.length;

  const itemLines = items
    .map(
      (item) =>
        `${item.name}    \`${formatCurrency(item.amount, bill.currency)}\``
    )
    .join("\n");

  const participantLines = participants
    .map((p) => {
      const icon = p.has_selected
        ? ":white_check_mark:"
        : ":hourglass_flowing_sand:";
      return `${icon} <@${p.user_id}>`;
    })
    .join("  ");

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: bill.name,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Total: ${formatCurrency(bill.total_amount, bill.currency)}*\nCreated by <@${bill.creator_id}> | ${items.length} items · ${totalCount} participants`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Items:*\n${itemLines}`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Selection: ${selectedCount}/${totalCount} completed*\n\`${progressBar(selectedCount, totalCount)}\`\n${participantLines}`,
      },
    },
  ];

  // Show "Complete Calculation" if all have selected, otherwise just "Cancel Bill"
  const actionElements: ActionsBlockElement[] = [];

  if (selectedCount === totalCount && totalCount > 0) {
    actionElements.push({
      type: "button",
      text: { type: "plain_text", text: "Complete Calculation" },
      style: "primary",
      action_id: "complete_calculation",
      value: bill.id,
    });
  }

  actionElements.push({
    type: "button",
    text: { type: "plain_text", text: "Manage Bill" },
    action_id: "manage_bill",
    value: bill.id,
  });

  blocks.push({
    type: "actions",
    block_id: `bill_actions_${bill.id}`,
    elements: actionElements,
  }, {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Bill ID: \`${bill.id.slice(0, 8)}\` | Created: <!date^${Math.floor(new Date(bill.created_at).getTime() / 1000)}^{date_short} at {time}|${bill.created_at}> | _Waiting for item selections..._`,
      },
    ],
  });

  return blocks;
}

function buildActiveCard(
  bill: Bill,
  participants: Participant[],
  itemBreakdowns?: Map<string, ItemBreakdown[]>,
  items?: BillItem[],
  creatorPaymentMethod?: PaymentMethod
): KnownBlock[] {
  const paidAmount = participants
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const isItemBased = bill.split_type === "item";

  const splitLabel = isItemBased
    ? `Item-based split (${participants.length} people)`
    : `Split equally (${participants.length} people)`;

  const statusEmoji: Record<string, string> = {
    paid: ":white_check_mark:",
    pending: ":hourglass_flowing_sand:",
    unpaid: ":red_circle:",
  };

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: bill.name,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Total: ${formatCurrency(bill.total_amount, bill.currency)}*\nCreated by <@${bill.creator_id}> | ${splitLabel}`,
      },
    },
  ];

  // Show items overview for item-based bills
  if (isItemBased && items && items.length > 0) {
    const itemList = items
      .map(
        (item) =>
          `${item.name}    \`${formatCurrency(item.amount, bill.currency)}\``
      )
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Items:*\n${itemList}`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // Build participant sections
  for (const p of participants) {
    const emoji = statusEmoji[p.status];
    const statusText =
      p.status.charAt(0).toUpperCase() + p.status.slice(1);
    const isCreator = p.user_id === bill.creator_id;
    const creatorBadge = isCreator ? " :crown:" : "";

    // Header line: emoji  @user  crown    amount    status
    let participantText = `${emoji}  <@${p.user_id}>${creatorBadge}    *${formatCurrency(p.amount, bill.currency)}*    _${statusText}_`;

    // Add item breakdown for item-based bills
    if (isItemBased && itemBreakdowns) {
      const breakdown = itemBreakdowns.get(p.id);
      if (breakdown && breakdown.length > 0) {
        const itemList = breakdown
          .map(
            (item) => `${item.name} \`${formatCurrency(item.amount, bill.currency)}\``
          )
          .join("  ·  ");
        participantText += `\n      ${itemList}`;
      }
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: participantText,
      },
    });
  }

  // Progress bar
  blocks.push({ type: "divider" }, {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Collected:* ${formatCurrency(paidAmount, bill.currency)} / ${formatCurrency(bill.total_amount, bill.currency)}\n\`${progressBar(paidAmount, bill.total_amount)}\``,
    },
  });

  // Add action buttons only for active bills
  if (bill.status === "active") {
    const actionElements: ActionsBlockElement[] = [];

    // Payment buttons based on creator's payment methods
    if (creatorPaymentMethod && hasPromptPay(creatorPaymentMethod)) {
      actionElements.push({
        type: "button",
        text: { type: "plain_text", text: "Pay via PromptPay" },
        action_id: "pay_via_promptpay",
        value: bill.id,
      });
    }
    if (creatorPaymentMethod && hasBankAccount(creatorPaymentMethod)) {
      actionElements.push({
        type: "button",
        text: { type: "plain_text", text: "Payment Info" },
        action_id: "payment_info",
        value: bill.id,
      });
    }

    actionElements.push(
      {
        type: "button",
        text: { type: "plain_text", text: "Mark as Paid" },
        style: "primary",
        action_id: "mark_paid",
        value: bill.id,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Manage Bill" },
        action_id: "manage_bill",
        value: bill.id,
      }
    );

    blocks.push({
      type: "actions",
      block_id: `bill_actions_${bill.id}`,
      elements: actionElements,
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
