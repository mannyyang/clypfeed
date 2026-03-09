import "dotenv/config";
// Allow Agent SDK to spawn Claude Code even when run inside a Claude Code session
delete process.env.CLAUDECODE;
import cron from "node-cron";
import { runAgent } from "./agent.js";

const args = process.argv.slice(2);

if (args.includes("--schedule")) {
  const scheduleIdx = args.indexOf("--schedule");
  const schedule = args[scheduleIdx + 1] || "0 8 * * *";

  if (!cron.validate(schedule)) {
    console.error(`Invalid cron expression: ${schedule}`);
    process.exit(1);
  }

  console.log(`AI News Aggregator scheduled: ${schedule}`);
  console.log("Press Ctrl+C to stop.\n");

  cron.schedule(schedule, () => {
    console.log(`\n--- Digest run: ${new Date().toISOString()} ---`);
    runAgent().catch((err) => {
      console.error("Agent run failed:", err);
    });
  });
} else {
  runAgent().catch((err) => {
    console.error("Agent run failed:", err);
    process.exit(1);
  });
}
