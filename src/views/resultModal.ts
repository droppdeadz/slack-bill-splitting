import { types } from "@slack/bolt";
type View = types.View;

export function buildResultModal(message: string): View {
  return {
    type: "modal",
    title: { type: "plain_text", text: "Manage Bill" },
    close: { type: "plain_text", text: "Close" },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: message },
      },
    ],
  };
}
