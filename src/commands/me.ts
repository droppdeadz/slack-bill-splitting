import type { App } from "@slack/bolt";
import { getUnpaidBillsForUser } from "../models/participant";
import { buildOutstandingSummary } from "../views/reminderMessage";
import { config } from "../config";

export function registerMeCommand(app: App): void {
  // This is handled as a subcommand of /copter
  // The routing happens in app.ts
}

export async function handleMeCommand(
  client: any,
  channelId: string,
  userId: string
): Promise<void> {
  const unpaidBills = getUnpaidBillsForUser(userId);

  const billData = unpaidBills.map((b: any) => ({
    bill_name: b.bill_name,
    amount: b.amount,
    creator_id: b.creator_id,
    channel_id: b.channel_id,
  }));

  const blocks = buildOutstandingSummary(billData, config.defaultCurrency);

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks,
    text: `You have ${unpaidBills.length} outstanding bill(s)`,
  });
}
