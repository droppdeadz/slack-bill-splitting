import { types } from "@slack/bolt";
type View = types.View;
type KnownBlock = types.KnownBlock;

export interface ModalOptions {
  splitType?: "equal" | "item";
  isReview?: boolean;
  billName?: string;
  itemsText?: string;
  totalAmount?: string;
  selectedUsers?: string[];
}

export function buildCreateBillModal(options?: ModalOptions): View {
  const splitType = options?.splitType || "equal";
  const isReview = options?.isReview ?? false;

  const blocks: KnownBlock[] = [];

  // Review banner (OCR results)
  if (isReview) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":camera: *Items extracted from your receipt.* Please review and edit.",
      },
    });
  }

  // File input for receipt image (only on the initial form, not the review modal)
  if (!isReview) {
    blocks.push({
      type: "input",
      block_id: "receipt_image",
      optional: true,
      label: {
        type: "plain_text",
        text: "Receipt Image (optional)",
      },
      hint: {
        type: "plain_text",
        text: "Upload a receipt photo to auto-fill items. Supports PNG, JPG, HEIC.",
      },
      element: {
        type: "file_input",
        action_id: "receipt_image_input",
        filetypes: ["png", "jpg", "jpeg", "heic"],
        max_files: 1,
      } as any,
    });
  }

  // Bill name
  const billNameElement: any = {
    type: "plain_text_input",
    action_id: "bill_name_input",
    placeholder: {
      type: "plain_text",
      text: "e.g., Lunch at Sushi place",
    },
  };
  if (options?.billName) {
    billNameElement.initial_value = options.billName;
  }

  blocks.push({
    type: "input",
    block_id: "bill_name",
    label: {
      type: "plain_text",
      text: "Bill Name",
    },
    element: billNameElement,
  });

  // Split type selector
  blocks.push({
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
  });

  if (splitType === "equal") {
    // Equal split: show total amount field
    const totalElement: any = {
      type: "plain_text_input",
      action_id: "total_amount_input",
      placeholder: {
        type: "plain_text",
        text: "e.g., 1320",
      },
    };
    if (options?.totalAmount) {
      totalElement.initial_value = options.totalAmount;
    }

    blocks.push({
      type: "input",
      block_id: "total_amount",
      label: {
        type: "plain_text",
        text: "Total Amount",
      },
      element: totalElement,
    });
  } else {
    // Item-based split: show items input
    const itemsElement: any = {
      type: "plain_text_input",
      action_id: "items_input",
      multiline: true,
      placeholder: {
        type: "plain_text",
        text: "Salmon Sushi 350\nRamen 280\nGyoza 340\nGreen Tea x4 350",
      },
    };
    if (options?.itemsText) {
      itemsElement.initial_value = options.itemsText;
    }

    blocks.push({
      type: "input",
      block_id: "items",
      label: {
        type: "plain_text",
        text: "Items (one per line: name amount)",
      },
      element: itemsElement,
      hint: {
        type: "plain_text",
        text: "Enter each item on its own line. The last number on each line is the cost.",
      },
    });
  }

  // Participants
  const participantsElement: any = {
    type: "multi_users_select",
    action_id: "participants_input",
    placeholder: {
      type: "plain_text",
      text: "Select people to split with",
    },
  };
  if (options?.selectedUsers && options.selectedUsers.length > 0) {
    participantsElement.initial_users = options.selectedUsers;
  }

  blocks.push({
    type: "input",
    block_id: "participants",
    label: {
      type: "plain_text",
      text: "Participants",
    },
    element: participantsElement,
  });

  return {
    type: "modal",
    callback_id: "create_bill_modal",
    title: {
      type: "plain_text",
      text: isReview ? "Review Scanned Bill" : "Create a Bill",
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
 * A "Processing..." modal shown while OCR is running.
 */
export function buildProcessingModal(channelId: string): View {
  return {
    type: "modal",
    callback_id: "ocr_processing",
    title: {
      type: "plain_text",
      text: "Processing Receipt",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    private_metadata: JSON.stringify({ channel_id: channelId }),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":hourglass_flowing_sand: *Scanning your receipt...*\n\nThis may take a few seconds.",
        },
      },
    ],
  };
}

/**
 * Error modal shown when OCR fails or cannot extract data.
 */
export function buildOcrErrorModal(channelId: string): View {
  return {
    type: "modal",
    callback_id: "ocr_retry_manual",
    title: {
      type: "plain_text",
      text: "Couldn't Read Receipt",
    },
    submit: {
      type: "plain_text",
      text: "Create Manually",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    private_metadata: JSON.stringify({ channel_id: channelId }),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":warning: *We couldn't extract items from your image.*\n\nThis can happen if the receipt is blurry, handwritten, or in an unsupported format.\n\nClick *Create Manually* to fill in the bill details yourself.",
        },
      },
    ],
  };
}

/**
 * Error modal shown when the Slack app is missing the files:read scope.
 */
export function buildScopeErrorModal(channelId: string): View {
  return {
    type: "modal",
    callback_id: "ocr_retry_manual",
    title: {
      type: "plain_text",
      text: "Setup Required",
    },
    submit: {
      type: "plain_text",
      text: "Create Manually",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    private_metadata: JSON.stringify({ channel_id: channelId }),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":lock: *Receipt scanning needs the `files:read` permission.*\n\nAsk your workspace admin to:\n1. Go to *<https://api.slack.com/apps|Slack App Settings>* → *OAuth & Permissions*\n2. Add the `files:read` bot scope\n3. Reinstall the app to the workspace\n\nIn the meantime, click *Create Manually* to enter items yourself.",
        },
      },
    ],
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
