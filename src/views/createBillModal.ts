import { types } from "@slack/bolt";
type View = types.View;
type KnownBlock = types.KnownBlock;

export interface ModalOptions {
  entryMethod?: "manual" | "upload";
  splitType?: "equal" | "item";
  isReview?: boolean;
  billName?: string;
  itemsText?: string;
  totalAmount?: string;
  selectedUsers?: string[];
}

export function buildCreateBillModal(options?: ModalOptions): View {
  const entryMethod = options?.entryMethod || "manual";
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

  // Entry method selector (only on initial form, not review)
  if (!isReview) {
    blocks.push({
      type: "input",
      block_id: "entry_method",
      label: {
        type: "plain_text",
        text: "How would you like to create this bill?",
      },
      element: {
        type: "radio_buttons",
        action_id: "entry_method_input",
        initial_option:
          entryMethod === "upload"
            ? {
                text: { type: "plain_text", text: "Upload Receipt Image" },
                description: {
                  type: "plain_text",
                  text: "Scan a receipt photo to auto-fill items",
                },
                value: "upload",
              }
            : {
                text: { type: "plain_text", text: "Enter Manually" },
                description: {
                  type: "plain_text",
                  text: "Type in bill details yourself",
                },
                value: "manual",
              },
        options: [
          {
            text: { type: "plain_text", text: "Enter Manually" },
            description: {
              type: "plain_text",
              text: "Type in bill details yourself",
            },
            value: "manual",
          },
          {
            text: { type: "plain_text", text: "Upload Receipt Image" },
            description: {
              type: "plain_text",
              text: "Scan a receipt photo to auto-fill items",
            },
            value: "upload",
          },
        ],
      },
      dispatch_action: true,
    });
  }

  if (!isReview && entryMethod === "upload") {
    // ── Upload mode ──
    // Receipt image (required)
    blocks.push({
      type: "input",
      block_id: "receipt_image",
      optional: false,
      label: {
        type: "plain_text",
        text: "Receipt Image",
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
      },
    });

    // Bill name (optional — will be extracted from receipt)
    blocks.push({
      type: "input",
      block_id: "bill_name",
      optional: true,
      label: {
        type: "plain_text",
        text: "Bill Name",
      },
      hint: {
        type: "plain_text",
        text: "Leave blank to use the store name from the receipt.",
      },
      element: {
        type: "plain_text_input",
        action_id: "bill_name_input",
        placeholder: {
          type: "plain_text",
          text: "e.g., Lunch at Sushi place",
        },
        ...(options?.billName ? { initial_value: options.billName } : {}),
      },
    });

    // Participants (optional — can be added in review modal)
    blocks.push({
      type: "input",
      block_id: "participants",
      optional: true,
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
        ...(options?.selectedUsers && options.selectedUsers.length > 0
          ? { initial_users: options.selectedUsers }
          : {}),
      },
    });
  } else {
    // ── Manual mode (or Review mode) ──

    // Bill name (required)
    blocks.push({
      type: "input",
      block_id: "bill_name",
      optional: false,
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
        ...(options?.billName ? { initial_value: options.billName } : {}),
      },
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
      // Total amount (required)
      blocks.push({
        type: "input",
        block_id: "total_amount",
        optional: false,
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
          ...(options?.totalAmount ? { initial_value: options.totalAmount } : {}),
        },
      });
    } else {
      // Items input (required)
      blocks.push({
        type: "input",
        block_id: "items",
        optional: false,
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
          ...(options?.itemsText ? { initial_value: options.itemsText } : {}),
        },
        hint: {
          type: "plain_text",
          text: "Enter each item on its own line. The last number on each line is the cost.",
        },
      });
    }

    // Participants (required)
    blocks.push({
      type: "input",
      block_id: "participants",
      optional: false,
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
        ...(options?.selectedUsers && options.selectedUsers.length > 0
          ? { initial_users: options.selectedUsers }
          : {}),
      },
    });
  }

  // Submit button text varies by mode
  let submitText = "Create Bill";
  if (!isReview && entryMethod === "upload") {
    submitText = "Scan Receipt";
  }

  return {
    type: "modal",
    callback_id: "create_bill_modal",
    title: {
      type: "plain_text",
      text: isReview ? "Review Scanned Bill" : "Create a Bill",
    },
    submit: {
      type: "plain_text",
      text: submitText,
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
    const match = /^(.+?)\s+([\d,]+(?:\.\d+)?)\s*$/.exec(line);
    if (match) {
      const name = match[1].trim();
      const amount = Number.parseFloat(match[2].replaceAll(",", ""));
      if (name && !Number.isNaN(amount) && amount > 0) {
        items.push({ name, amount });
      }
    }
  }

  return items;
}
