import "dotenv/config";

export const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    appToken: process.env.SLACK_APP_TOKEN!,
  },
  port: Number.parseInt(process.env.PORT || "3000", 10),
  databasePath: process.env.DATABASE_PATH || "./data/bills.db",
  defaultCurrency: process.env.DEFAULT_CURRENCY || "THB",
  reminderCron: process.env.REMINDER_CRON || "0 9 * * *",
  slashCommand: process.env.SLASH_COMMAND || "slack-bill-splitting",
};
