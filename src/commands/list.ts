import {
  getActiveBillsByChannel,
  getActiveBillsByChannelAndCreator,
  getActiveBillsOwedByUserInChannel,
} from "../models/bill";
import { getParticipantsByBill } from "../models/participant";
import { formatCurrency } from "../utils/formatCurrency";
import { config } from "../config";

export type ListFilter = "all" | "mine" | "owed";

export async function handleListCommand(
  client: any,
  channelId: string,
  userId: string,
  filter: ListFilter = "all"
): Promise<void> {
  let bills;
  let headerText: string;

  switch (filter) {
    case "mine":
      bills = getActiveBillsByChannelAndCreator(channelId, userId);
      headerText = "Bills Created by You";
      break;
    case "owed":
      bills = getActiveBillsOwedByUserInChannel(channelId, userId);
      headerText = "Bills You Owe";
      break;
    case "all":
    default:
      bills = getActiveBillsByChannel(channelId);
      headerText = "Active Bills in This Channel";
      break;
  }

  if (bills.length === 0) {
    const emptyMessages: Record<ListFilter, string> = {
      all: "No active bills in this channel.",
      mine: "You haven't created any active bills in this channel.",
      owed: "You don't owe on any active bills in this channel.",
    };
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: emptyMessages[filter],
    });
    return;
  }

  const billSummaries = bills.map((bill) => {
    const participants = getParticipantsByBill(bill.id);
    if (bill.status === "pending") {
      const selectedCount = participants.filter((p) => p.has_selected).length;
      return `- :hourglass_flowing_sand: *${bill.name}* — ${formatCurrency(bill.total_amount, bill.currency)} | Selecting items: ${selectedCount}/${participants.length} | by <@${bill.creator_id}>`;
    }
    const paidCount = participants.filter((p) => p.status === "paid").length;
    return `- *${bill.name}* — ${formatCurrency(bill.total_amount, bill.currency)} | ${paidCount}/${participants.length} paid | by <@${bill.creator_id}>`;
  });

  const filterHint =
    `_Filters: \`/${config.slashCommand} list all\` · \`/${config.slashCommand} list mine\` · \`/${config.slashCommand} list owed\`_`;

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: headerText },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: billSummaries.join("\n"),
        },
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: filterHint },
        ],
      },
    ],
    text: `Active bills: ${bills.length}`,
  });
}
