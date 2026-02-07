import { types } from "@slack/bolt";
type View = types.View;
type KnownBlock = types.KnownBlock;

import type { PaymentMethod } from "../models/paymentMethod";

function promptpayTypeLabel(type: string): string {
  if (type === "phone") return "Phone Number";
  if (type === "national_id") return "National ID";
  return "e-Wallet ID";
}

const THAI_BANKS = [
  "KBank",
  "SCB",
  "BBL",
  "KTB",
  "TTB",
  "Krungsri",
  "GSB",
  "CIMB Thai",
  "TISCO",
  "KKP",
  "LH Bank",
  "UOB",
];

export function buildPaymentModal(existing?: PaymentMethod): View {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "PromptPay" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_Set up PromptPay so participants can pay you via QR code. Both fields are optional._",
      },
    },
    {
      type: "input",
      block_id: "promptpay_type",
      optional: true,
      label: { type: "plain_text", text: "PromptPay Type" },
      element: {
        type: "static_select",
        action_id: "promptpay_type_input",
        placeholder: { type: "plain_text", text: "Select type" },
        options: [
          {
            text: { type: "plain_text", text: "Phone Number" },
            value: "phone",
          },
          {
            text: { type: "plain_text", text: "National ID" },
            value: "national_id",
          },
          {
            text: { type: "plain_text", text: "e-Wallet ID" },
            value: "ewallet",
          },
        ],
        ...(existing?.promptpay_type
          ? {
              initial_option: {
                text: {
                  type: "plain_text",
                  text: promptpayTypeLabel(existing.promptpay_type),
                },
                value: existing.promptpay_type,
              },
            }
          : {}),
      },
    },
    {
      type: "input",
      block_id: "promptpay_id",
      optional: true,
      label: { type: "plain_text", text: "PromptPay ID" },
      element: {
        type: "plain_text_input",
        action_id: "promptpay_id_input",
        placeholder: { type: "plain_text", text: "e.g. 0812345678" },
        ...(existing?.promptpay_id
          ? { initial_value: existing.promptpay_id }
          : {}),
      },
    },
    { type: "divider" },
    {
      type: "header",
      text: { type: "plain_text", text: "Bank Account" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_Set up a bank account so participants can transfer to you directly. All three fields are optional._",
      },
    },
    {
      type: "input",
      block_id: "bank_name",
      optional: true,
      label: { type: "plain_text", text: "Bank" },
      element: {
        type: "static_select",
        action_id: "bank_name_input",
        placeholder: { type: "plain_text", text: "Select bank" },
        options: THAI_BANKS.map((bank) => ({
          text: { type: "plain_text", text: bank },
          value: bank,
        })),
        ...(existing?.bank_name
          ? {
              initial_option: {
                text: { type: "plain_text", text: existing.bank_name },
                value: existing.bank_name,
              },
            }
          : {}),
      },
    },
    {
      type: "input",
      block_id: "bank_account_number",
      optional: true,
      label: { type: "plain_text", text: "Account Number" },
      element: {
        type: "plain_text_input",
        action_id: "bank_account_number_input",
        placeholder: { type: "plain_text", text: "e.g. 1234567890" },
        ...(existing?.bank_account_number
          ? { initial_value: existing.bank_account_number }
          : {}),
      },
    },
    {
      type: "input",
      block_id: "bank_account_name",
      optional: true,
      label: { type: "plain_text", text: "Account Holder Name" },
      element: {
        type: "plain_text_input",
        action_id: "bank_account_name_input",
        placeholder: { type: "plain_text", text: "e.g. John Doe" },
        ...(existing?.bank_account_name
          ? { initial_value: existing.bank_account_name }
          : {}),
      },
    },
  ];

  return {
    type: "modal",
    callback_id: "payment_method_modal",
    title: {
      type: "plain_text",
      text: "Payment Methods",
    },
    submit: {
      type: "plain_text",
      text: "Save",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks,
  };
}
