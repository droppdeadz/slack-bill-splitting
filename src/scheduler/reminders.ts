import cron from "node-cron";
import type { App } from "@slack/bolt";
import { getDb } from "../database/connection";
import { buildReminderDM } from "../views/reminderMessage";
import { config } from "../config";

interface UnpaidEntry {
  user_id: string;
  amount: number;
  bill_id: string;
  bill_name: string;
  creator_id: string;
  channel_id: string;
  currency: string;
}

export function startReminderScheduler(app: App): void {
  cron.schedule(config.reminderCron, async () => {
    console.log("[Scheduler] Running automatic reminders...");

    const db = getDb();
    const unpaid = db
      .prepare(
        `SELECT p.user_id, p.amount, b.id as bill_id, b.name as bill_name,
                b.creator_id, b.channel_id, b.currency
         FROM participants p
         JOIN bills b ON p.bill_id = b.id
         WHERE p.status != 'paid' AND b.status = 'active'`
      )
      .all() as UnpaidEntry[];

    let sentCount = 0;
    for (const entry of unpaid) {
      try {
        await app.client.chat.postMessage({
          token: config.slack.botToken,
          channel: entry.user_id,
          blocks: buildReminderDM(
            entry.bill_name,
            entry.amount,
            entry.currency,
            entry.creator_id,
            entry.channel_id,
            entry.bill_id
          ),
          text: `Daily reminder: You owe ${entry.amount} for ${entry.bill_name}`,
        });
        sentCount++;
      } catch (err) {
        console.error(
          `[Scheduler] Failed to remind ${entry.user_id}:`,
          err
        );
      }
    }

    console.log(`[Scheduler] Sent ${sentCount} reminder(s)`);
  });

  console.log(
    `[Scheduler] Auto-reminders scheduled: ${config.reminderCron}`
  );
}
