import { types } from "@slack/bolt";
type View = types.View;

export function buildCreateBillModal(): View {
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
    blocks: [
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
            text: { type: "plain_text", text: "Split Equally" },
            value: "equal",
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
          placeholder: {
            type: "plain_text",
            text: "Select people to split with",
          },
        },
      },
    ],
  };
}
