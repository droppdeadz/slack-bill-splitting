import type { App } from "@slack/bolt";
import { getActiveBillsByChannel } from "../models/bill";
import { getParticipantsByBill } from "../models/participant";
import { formatCurrency } from "../utils/formatCurrency";

export function registerListCommand(app: App): void {
  // This is handled as a subcommand of /copter
  // The routing happens in app.ts
}

export async function handleListCommand(
  client: any,
  channelId: string,
  userId: string
): Promise<void> {
  const bills = getActiveBillsByChannel(channelId);

  if (bills.length === 0) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "No active bills in this channel.",
    });
    return;
  }

  const billSummaries = bills.map((bill) => {
    const participants = getParticipantsByBill(bill.id);
    const paidCount = participants.filter((p) => p.status === "paid").length;
    return `- *${bill.name}* — ${formatCurrency(bill.total_amount, bill.currency)} | ${paidCount}/${participants.length} paid | by <@${bill.creator_id}>`;
  });

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Active Bills in This Channel" },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: billSummaries.join("\n"),
        },
      },
    ],
    text: `Active bills: ${bills.length}`,
  });
}
