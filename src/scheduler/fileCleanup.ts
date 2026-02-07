import cron from "node-cron";
import type { App } from "@slack/bolt";
import { getFilesForCleanup, markFileDeleted } from "../models/billFile";
import { config } from "../config";

export function startFileCleanupScheduler(app: App): void {
  cron.schedule(config.fileCleanupCron, async () => {
    console.log("[FileCleanup] Running file cleanup...");

    const files = getFilesForCleanup(7);
    if (files.length === 0) {
      console.log("[FileCleanup] No files to clean up");
      return;
    }

    let deleted = 0;
    let skipped = 0;

    for (const file of files) {
      try {
        await app.client.files.delete({
          token: config.slack.botToken,
          file: file.slack_file_id,
        });
        markFileDeleted(file.id);
        deleted++;
      } catch (err: any) {
        const errorCode = err?.data?.error || err?.message || "";

        if (
          errorCode === "file_not_found" ||
          errorCode === "file_deleted"
        ) {
          // File already gone — mark as handled
          markFileDeleted(file.id);
          deleted++;
        } else if (errorCode === "cant_delete_file") {
          // User-owned file — bot can't delete, stop retrying
          markFileDeleted(file.id);
          skipped++;
        } else {
          // Unknown error — skip, retry on next run
          console.error(
            `[FileCleanup] Failed to delete file ${file.slack_file_id}:`,
            errorCode
          );
        }
      }
    }

    console.log(
      `[FileCleanup] Done: ${deleted} deleted, ${skipped} skipped (user-owned)`
    );
  });

  console.log(
    `[FileCleanup] File cleanup scheduled: ${config.fileCleanupCron}`
  );
}
