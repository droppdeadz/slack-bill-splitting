import { types } from "@slack/bolt";
type View = types.View;
type KnownBlock = types.KnownBlock;

export interface CustomSplitOptions {
  splitType: "equal" | "custom";
  participantIds: string[];
  participantNames: Record<string, string>; // userId -> display name
}

export function buildCreateBillModal(options?: CustomSplitOptions): View {
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
            text: options?.splitType === "custom" ? "Custom Amounts" : "Split Equally",
          },
          value: options?.splitType === "custom" ? "custom" : "equal",
        },
        options: [
          {
            text: { type: "plain_text", text: "Split Equally" },
            value: "equal",
          },
          {
            text: { type: "plain_text", text: "Custom Amounts" },
            value: "custom",
          },
        ],
      },
      dispatch_action: true,
    },
    {
      type: "input",
      block_id: "participants",
      label: {
        type: "plain_text",
        text: "Participants",
      },
      element: {
        type: "multi_users_select",
        action_id: "participants_input",
        ...(options?.participantIds?.length
          ? { initial_users: options.participantIds }
          : {}),
        placeholder: {
          type: "plain_text",
          text: "Select people to split with",
        },
      },
      dispatch_action: true,
    },
  ];

  // Add per-participant amount inputs when custom split is selected
  if (
    options?.splitType === "custom" &&
    options.participantIds.length > 0
  ) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Enter the amount each person owes:*",
      },
    });

    for (const userId of options.participantIds) {
      const displayName = options.participantNames[userId] || userId;
      blocks.push({
        type: "input",
        block_id: `custom_amount_${userId}`,
        label: {
          type: "plain_text",
          text: displayName,
        },
        element: {
          type: "plain_text_input",
          action_id: "custom_amount_input",
          placeholder: {
            type: "plain_text",
            text: "e.g., 500",
          },
        },
      });
    }
  } else if (options?.splitType === "custom") {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_Select participants above to enter custom amounts._",
      },
    });
  }

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
