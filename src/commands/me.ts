import { getUnpaidBillsForUser } from "../models/participant";
import { buildOutstandingSummary } from "../views/reminderMessage";
import { config } from "../config";

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

  // Open a DM channel with the user and send the summary there
  const dm = await client.conversations.open({ users: userId });
  const dmChannelId = dm.channel?.id;

  if (dmChannelId) {
    await client.chat.postMessage({
      channel: dmChannelId,
      blocks,
      text: `You have ${unpaidBills.length} outstanding bill(s)`,
    });

    // Send a brief ephemeral confirmation in the original channel
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: ":mailbox_with_mail: Your outstanding bills summary has been sent to your DMs.",
    });
  } else {
    // Fallback to ephemeral if DM fails
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      blocks,
      text: `You have ${unpaidBills.length} outstanding bill(s)`,
    });
  }
}
