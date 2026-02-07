import type { App, AllMiddlewareArgs } from "@slack/bolt";
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

    // Validate paired fields
    const errors: Record<string, string> = {};
    if (promptpayType && !promptpayId) {
      errors.promptpay_id = "Please enter your PromptPay ID";
    }
    if (!promptpayType && promptpayId) {
      errors.promptpay_type = "Please select a PromptPay type";
    }
    if (bankName && !bankAccountNumber) {
      errors.bank_account_number = "Please enter your account number";
    }
    if (!bankName && bankAccountNumber) {
      errors.bank_name = "Please select a bank";
    }

    if (Object.keys(errors).length > 0) {
      await ack({ response_action: "errors", errors });
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
  client: AllMiddlewareArgs["client"],
  triggerId: string,
  userId: string
): Promise<void> {
  const existing = getPaymentMethodByUser(userId);
  await client.views.open({
    trigger_id: triggerId,
    view: buildPaymentModal(existing),
  });
}
