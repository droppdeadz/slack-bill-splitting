import type { App } from "@slack/bolt";
import { getCompletedBillsByChannel } from "../models/bill";
import { getParticipantsByBill } from "../models/participant";
import { formatCurrency } from "../utils/formatCurrency";

export function registerHistoryCommand(app: App): void {
  // This is handled as a subcommand of /copter
  // The routing happens in app.ts
}

export async function handleHistoryCommand(
  client: any,
  channelId: string,
  userId: string
): Promise<void> {
  const bills = getCompletedBillsByChannel(channelId);

  if (bills.length === 0) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "No completed or cancelled bills in this channel.",
    });
    return;
  }

  const billLines = bills.map((bill) => {
    const participants = getParticipantsByBill(bill.id);
    const statusIcon =
      bill.status === "completed" ? ":white_check_mark:" : ":no_entry_sign:";
    return `${statusIcon} *${bill.name}* — ${formatCurrency(bill.total_amount, bill.currency)} | ${participants.length} people | by <@${bill.creator_id}>`;
  });

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Bill History" },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: billLines.join("\n"),
        },
      },
    ],
    text: `Bill history: ${bills.length} bills`,
  });
}
