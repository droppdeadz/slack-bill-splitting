import { types } from "@slack/bolt";
type View = types.View;
type KnownBlock = types.KnownBlock;

export interface ModalOptions {
  splitType: "equal" | "item";
}

export function buildCreateBillModal(options?: ModalOptions): View {
  const splitType = options?.splitType || "equal";

  const blocks: KnownBlock[] = [
    {
      type: "input",
      block_id: "bill_name",
      label: {
        type: "plain_text",
        text: "Bill Name",
      },
      element: {
        type: "plain_text_input",
        action_id: "bill_name_input",
        placeholder: {
          type: "plain_text",
          text: "e.g., Lunch at Sushi place",
        },
      },
    },
    {
      type: "input",
      block_id: "split_type",
      label: {
        type: "plain_text",
        text: "Split Type",
      },
      element: {
        type: "static_select",
        action_id: "split_type_input",
        initial_option: {
          text: {
            type: "plain_text",
            text: splitType === "item" ? "Item-based" : "Split Equally",
          },
          value: splitType,
        },
        options: [
          {
            text: { type: "plain_text", text: "Split Equally" },
            value: "equal",
          },
          {
            text: { type: "plain_text", text: "Item-based" },
            value: "item",
          },
        ],
      },
      dispatch_action: true,
    },
  ];

  if (splitType === "equal") {
    // Equal split: show total amount field
    blocks.push({
      type: "input",
      block_id: "total_amount",
      label: {
        type: "plain_text",
        text: "Total Amount",
      },
      element: {
        type: "plain_text_input",
        action_id: "total_amount_input",
        placeholder: {
          type: "plain_text",
          text: "e.g., 1320",
        },
      },
    });
  } else {
    // Item-based split: show items input
    blocks.push({
      type: "input",
      block_id: "items",
      label: {
        type: "plain_text",
        text: "Items (one per line: name amount)",
      },
      element: {
        type: "plain_text_input",
        action_id: "items_input",
        multiline: true,
        placeholder: {
          type: "plain_text",
          text: "Salmon Sushi 350\nRamen 280\nGyoza 340\nGreen Tea x4 350",
        },
      },
      hint: {
        type: "plain_text",
        text: "Enter each item on its own line. The last number on each line is the cost.",
      },
    });
  }

  blocks.push({
    type: "input",
    block_id: "participants",
    label: {
      type: "plain_text",
      text: "Participants",
    },
    element: {
      type: "multi_users_select",
      action_id: "participants_input",
      placeholder: {
        type: "plain_text",
        text: "Select people to split with",
      },
    },
  });

  return {
    type: "modal",
    callback_id: "create_bill_modal",
    title: {
      type: "plain_text",
      text: "Create a Bill",
    },
    submit: {
      type: "plain_text",
      text: "Create Bill",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks,
  };
}

/**
 * Parse items text input into structured items.
 * Format: "Item Name 123" or "Item Name 123.45" — last number on the line is the amount.
 */
export function parseItemsInput(
  text: string
): { name: string; amount: number }[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: { name: string; amount: number }[] = [];

  for (const line of lines) {
    // Match the last number (int or decimal) on the line
    const match = line.match(/^(.+?)\s+([\d,]+(?:\.\d+)?)\s*$/);
    if (match) {
      const name = match[1].trim();
      const amount = parseFloat(match[2].replace(/,/g, ""));
      if (name && !isNaN(amount) && amount > 0) {
        items.push({ name, amount });
      }
    }
  }

  return items;
}
