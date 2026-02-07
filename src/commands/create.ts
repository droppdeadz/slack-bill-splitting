import type { App } from "@slack/bolt";
import { createBill, getBillById, updateBillMessageTs, updateBillStatus } from "../models/bill";
import {
  addParticipantsBulk,
  getParticipantsByBill,
  getParticipantByBillAndUser,
  updateParticipantStatus,
  areAllParticipantsPaid,
} from "../models/participant";
import { addBillItemsBulk, getItemsByBill } from "../models/billItem";
import { buildBillCard } from "../views/billCard";
import { buildItemSelectDM } from "../views/itemSelectMessage";
import { splitEqual } from "../utils/splitCalculator";
import {
  buildCreateBillModal,
  buildProcessingModal,
  buildOcrErrorModal,
  buildScopeErrorModal,
  parseItemsInput,
} from "../views/createBillModal";
import { recognizeReceipt, MissingScopeError } from "../services/receiptOcr";
import { parseReceiptText } from "../services/receiptParser";

export function registerCreateHandlers(app: App): void {
  // Dynamic modal update: when split_type changes, rebuild the modal
  app.action("split_type_input", async ({ ack, body, client }) => {
    await ack();

    const view = (body as any).view;
    const values = view.state.values;
    const splitType =
      values.split_type?.split_type_input?.selected_option?.value || "equal";

    await client.views.update({
      view_id: view.id,
      hash: view.hash,
      view: {
        ...buildCreateBillModal({ splitType: splitType as "equal" | "item" }),
        private_metadata: view.private_metadata,
      },
    });
  });

  // Acknowledge participants_input changes (no modal update needed)
  app.action("participants_input", async ({ ack }) => {
    await ack();
  });

  // Acknowledge receipt image file input changes
  app.action("receipt_image_input", async ({ ack }) => {
    await ack();
  });

  // Modal submission handler for creating a bill
  app.view("create_bill_modal", async ({ ack, view, client, body }) => {
    const values = view.state.values;

    // Check if a receipt image was uploaded
    const fileData =
      values.receipt_image?.receipt_image_input;
    const files = (fileData as any)?.files as
      | { id: string }[]
      | undefined;

    if (files && files.length > 0) {
      // Image uploaded — hand off to OCR flow
      await handleReceiptUpload(ack, view, client, body, files[0].id);
      return;
    }

    // No image — existing manual flow
    const billName = values.bill_name.bill_name_input.value!;
    const splitType = values.split_type.split_type_input.selected_option!
      .value as "equal" | "item";
    const participantIds =
      values.participants.participants_input.selected_users!;

    if (participantIds.length === 0) {
      await ack({
        response_action: "errors",
        errors: { participants: "Please select at least one participant" },
      });
      return;
    }

    if (splitType === "equal") {
      await handleEqualSplit(ack, view, client, body, billName, participantIds);
    } else {
      await handleItemSplit(ack, view, client, body, billName, participantIds);
    }
  });

  // "Create Manually" fallback from OCR error modal
  app.view("ocr_retry_manual", async ({ ack, view }) => {
    const metadata = JSON.parse(view.private_metadata);
    await ack({
      response_action: "update",
      view: {
        ...buildCreateBillModal(),
        private_metadata: JSON.stringify({
          channel_id: metadata.channel_id,
        }),
      },
    });
  });
}

/**
 * Handle a submission that includes a receipt image:
 * 1. Show "Processing..." modal
 * 2. Run OCR + parse
 * 3. Update modal with pre-filled review form (or error)
 */
async function handleReceiptUpload(
  ack: any,
  view: any,
  client: any,
  body: any,
  fileId: string
): Promise<void> {
  const metadata = JSON.parse(view.private_metadata);
  const channelId = metadata.channel_id;

  // Show processing modal (keeps the modal alive while we work)
  await ack({
    response_action: "update",
    view: {
      ...buildProcessingModal(channelId),
      private_metadata: view.private_metadata,
    },
  });

  const viewId = view.id;

  try {
    // Run OCR
    const ocrResult = await recognizeReceipt(fileId, client);
    const parsed = parseReceiptText(ocrResult.text);

    const hasItems = parsed.items.length > 0;
    const hasTotal = parsed.total !== null && parsed.total > 0;

    if (!hasItems && !hasTotal) {
      // Nothing useful extracted — show error
      await client.views.update({
        view_id: viewId,
        view: {
          ...buildOcrErrorModal(channelId),
          private_metadata: view.private_metadata,
        },
      });
      return;
    }

    // Build the review modal with pre-filled data
    const billName = parsed.storeName || "";

    if (hasItems) {
      // Item-based split with extracted items
      const itemsText = parsed.items
        .map((item) => `${item.name} ${item.amount}`)
        .join("\n");

      const reviewModal = buildCreateBillModal({
        isReview: true,
        splitType: "item",
        billName,
        itemsText,
      });

      await client.views.update({
        view_id: viewId,
        view: {
          ...reviewModal,
          private_metadata: view.private_metadata,
        },
      });
    } else {
      // Only total found — equal split
      const reviewModal = buildCreateBillModal({
        isReview: true,
        splitType: "equal",
        billName,
        totalAmount: String(parsed.total),
      });

      await client.views.update({
        view_id: viewId,
        view: {
          ...reviewModal,
          private_metadata: view.private_metadata,
        },
      });
    }
  } catch (err) {
    console.error("Receipt OCR failed:", err);

    // Show specific error for missing scope vs generic OCR error
    const errorModal =
      err instanceof MissingScopeError
        ? buildScopeErrorModal(channelId)
        : buildOcrErrorModal(channelId);

    await client.views.update({
      view_id: viewId,
      view: {
        ...errorModal,
        private_metadata: view.private_metadata,
      },
    });
  }
}

async function handleEqualSplit(
  ack: any,
  view: any,
  client: any,
  body: any,
  billName: string,
  participantIds: string[]
): Promise<void> {
  const values = view.state.values;
  const totalAmountStr = values.total_amount?.total_amount_input?.value;

  if (!totalAmountStr) {
    await ack({
      response_action: "errors",
      errors: { total_amount: "Please enter a total amount" },
    });
    return;
  }

  const totalAmount = parseFloat(totalAmountStr);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    await ack({
      response_action: "errors",
      errors: { total_amount: "Please enter a valid positive number" },
    });
    return;
  }

  await ack();

  const metadata = JSON.parse(view.private_metadata);
  const channelId = metadata.channel_id;
  const creatorId = body.user.id;

  // Auto-include creator as participant (deduplicate)
  if (!participantIds.includes(creatorId)) {
    participantIds.push(creatorId);
  }

  const bill = createBill({
    name: billName,
    totalAmount,
    splitType: "equal",
    creatorId,
    channelId,
  });

  const amounts = splitEqual(totalAmount, participantIds.length);
  const participantData = participantIds.map(
    (userId: string, i: number) => ({
      userId,
      amount: amounts[i],
    })
  );

  addParticipantsBulk(bill.id, participantData);

  // Auto-mark creator as paid (bill owner paid upfront)
  const creatorParticipant = getParticipantByBillAndUser(bill.id, creatorId);
  if (creatorParticipant) {
    updateParticipantStatus(creatorParticipant.id, "paid");
  }

  const participants = getParticipantsByBill(bill.id);
  const freshBill = getBillById(bill.id)!;

  const result = await client.chat.postMessage({
    channel: channelId,
    blocks: buildBillCard(freshBill, participants),
    text: `New bill: ${billName} - ${totalAmount}`,
  });

  if (result.ts) {
    updateBillMessageTs(bill.id, result.ts);
  }

  // Auto-complete if creator is the only participant
  if (areAllParticipantsPaid(bill.id)) {
    updateBillStatus(bill.id, "completed");
    const completedBill = getBillById(bill.id)!;
    const updatedParticipants = getParticipantsByBill(bill.id);
    if (completedBill.message_ts) {
      await client.chat.update({
        channel: channelId,
        ts: completedBill.message_ts,
        blocks: buildBillCard(completedBill, updatedParticipants),
        text: `Bill completed: ${billName}`,
      });
    }
  }
}

async function handleItemSplit(
  ack: any,
  view: any,
  client: any,
  body: any,
  billName: string,
  participantIds: string[]
): Promise<void> {
  const values = view.state.values;
  const itemsText = values.items?.items_input?.value;

  if (!itemsText) {
    await ack({
      response_action: "errors",
      errors: { items: "Please enter at least one item" },
    });
    return;
  }

  const parsedItems = parseItemsInput(itemsText);
  if (parsedItems.length === 0) {
    await ack({
      response_action: "errors",
      errors: {
        items:
          'Could not parse any items. Use format: "Item Name 123" (one per line)',
      },
    });
    return;
  }

  const totalAmount = parsedItems.reduce((sum, item) => sum + item.amount, 0);

  await ack();

  const metadata = JSON.parse(view.private_metadata);
  const channelId = metadata.channel_id;
  const creatorId = body.user.id;

  // Auto-include creator as participant (deduplicate)
  if (!participantIds.includes(creatorId)) {
    participantIds.push(creatorId);
  }

  // Create bill in "pending" status
  const bill = createBill({
    name: billName,
    totalAmount,
    splitType: "item",
    creatorId,
    channelId,
  });

  // Add bill items
  const billItems = addBillItemsBulk(bill.id, parsedItems);

  // Add participants with amount=0 (will be calculated after item selection)
  const participantData = participantIds.map((userId: string) => ({
    userId,
    amount: 0,
  }));
  addParticipantsBulk(bill.id, participantData);

  const participants = getParticipantsByBill(bill.id);
  const freshBill = getBillById(bill.id)!;

  // Post bill card in channel (pending state)
  const result = await client.chat.postMessage({
    channel: channelId,
    blocks: buildBillCard(freshBill, participants, billItems),
    text: `New bill: ${billName} - ${totalAmount} (waiting for item selections)`,
  });

  if (result.ts) {
    updateBillMessageTs(bill.id, result.ts);
  }

  // DM each participant with item selection checklist
  for (const userId of participantIds) {
    try {
      await client.chat.postMessage({
        channel: userId,
        blocks: buildItemSelectDM(
          billName,
          creatorId,
          bill.id,
          billItems,
          freshBill.currency
        ),
        text: `Select your items for "${billName}"`,
      });
    } catch (err) {
      console.error(
        `Failed to send item selection DM to ${userId}:`,
        err
      );
    }
  }
}
