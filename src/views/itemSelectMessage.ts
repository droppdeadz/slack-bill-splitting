import { types } from "@slack/bolt";
type KnownBlock = types.KnownBlock;
import type { BillItem } from "../models/billItem";
import { formatCurrency } from "../utils/formatCurrency";

export function buildItemSelectDM(
  billName: string,
  creatorId: string,
  billId: string,
  items: BillItem[],
  currency: string
): KnownBlock[] {
  const checkboxOptions = items.map((item) => ({
    text: {
      type: "mrkdwn" as const,
      text: `*${item.name}*  —  ${formatCurrency(item.amount, currency)}`,
    },
    value: item.id,
  }));

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:receipt: You've been added to *${billName}* by <@${creatorId}>.\nSelect the items you owe for:`,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      block_id: `item_select_${billId}`,
      elements: [
        {
          type: "checkboxes",
          action_id: "item_checkboxes",
          options: checkboxOptions,
        },
      ],
    },
    {
      type: "actions",
      block_id: `item_submit_${billId}`,
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Confirm Selection" },
          style: "primary",
          action_id: "submit_item_selection",
          value: billId,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Select all items you ordered. Shared items will be split among everyone who selects them._",
        },
      ],
    },
  ];
}
