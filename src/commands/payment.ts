import type { App } from "@slack/bolt";
import {
  getPaymentMethodByUser,
  upsertPaymentMethod,
} from "../models/paymentMethod";
import { buildPaymentModal } from "../views/paymentModal";

export function registerPaymentHandlers(app: App): void {
  // Payment method modal submission handler
  app.view("payment_method_modal", async ({ ack, view, body }) => {
    const values = view.state.values;
    const userId = body.user.id;

    const promptpayType =
      values.promptpay_type?.promptpay_type_input?.selected_option?.value ||
      null;
    const promptpayId =
      values.promptpay_id?.promptpay_id_input?.value?.trim() || null;
    const bankName =
      values.bank_name?.bank_name_input?.selected_option?.value || null;
    const bankAccountNumber =
      values.bank_account_number?.bank_account_number_input?.value?.trim() ||
      null;
    const bankAccountName =
      values.bank_account_name?.bank_account_name_input?.value?.trim() || null;

    // Validate: if promptpay_type is set, promptpay_id must be set (and vice versa)
    if ((promptpayType && !promptpayId) || (!promptpayType && promptpayId)) {
      await ack({
        response_action: "errors",
        errors: {
          ...(promptpayType && !promptpayId
            ? { promptpay_id: "Please enter your PromptPay ID" }
            : {}),
          ...(!promptpayType && promptpayId
            ? { promptpay_type: "Please select a PromptPay type" }
            : {}),
        },
      });
      return;
    }

    // Validate: if bank_name is set, account_number must be set (and vice versa)
    if (
      (bankName && !bankAccountNumber) ||
      (!bankName && bankAccountNumber)
    ) {
      await ack({
        response_action: "errors",
        errors: {
          ...(bankName && !bankAccountNumber
            ? {
                bank_account_number: "Please enter your account number",
              }
            : {}),
          ...(!bankName && bankAccountNumber
            ? { bank_name: "Please select a bank" }
            : {}),
        },
      });
      return;
    }

    // If everything is empty, we still save (clearing previous data)
    upsertPaymentMethod(userId, {
      promptpayType,
      promptpayId,
      bankName,
      bankAccountNumber,
      bankAccountName,
    });

    await ack();
  });
}

export async function openPaymentModal(
  client: any,
  triggerId: string,
  userId: string
): Promise<void> {
  const existing = getPaymentMethodByUser(userId);
  await client.views.open({
    trigger_id: triggerId,
    view: buildPaymentModal(existing),
  });
}
