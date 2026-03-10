import cron from "node-cron";
import { loadConfig, saveConfig } from "../config.js";
import { runAgent } from "../agent.js";
import { buildPages } from "../pages.js";

let activeTask: cron.ScheduledTask | null = null;
let currentCron: string = "";
let isRunning = false;

export async function startScheduler(cronExpr?: string): Promise<void> {
  const config = await loadConfig();
  const expr = cronExpr || config.schedule || "0 8 * * *";

  stopScheduler();

  if (!cron.validate(expr)) {
    throw new Error(`Invalid cron expression: ${expr}`);
  }

  currentCron = expr;
  activeTask = cron.schedule(expr, async () => {
    if (isRunning) {
      console.error("[clypfeed] Skipping scheduled run — previous run still active");
      return;
    }
    isRunning = true;
    console.error(`[clypfeed] Scheduled digest run: ${new Date().toISOString()}`);
    try {
      delete process.env.CLAUDECODE;
      await runAgent();
      await buildPages();
      console.error("[clypfeed] Scheduled run completed successfully");
    } catch (err) {
      console.error("[clypfeed] Scheduled run failed:", err);
    } finally {
      isRunning = false;
    }
  });

  console.error(`[clypfeed] Scheduler started: ${expr}`);
}

export function stopScheduler(): void {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
    console.error("[clypfeed] Scheduler stopped");
  }
}

export function getScheduleStatus(): string {
  return JSON.stringify({
    active: activeTask !== null,
    cron: currentCron || null,
    running: isRunning,
  });
}

export async function setSchedule(cronExpr: string): Promise<string> {
  if (!cron.validate(cronExpr)) {
    return `Invalid cron expression: "${cronExpr}". Examples: "0 8 * * *" (daily 8am), "0 9 * * 1-5" (weekdays 9am)`;
  }

  await startScheduler(cronExpr);

  const config = await loadConfig();
  config.schedule = cronExpr;
  await saveConfig(config);

  return `Schedule set to "${cronExpr}" and saved.`;
}

export async function runDigestNow(): Promise<string> {
  if (isRunning) {
    return "A digest run is already in progress. Please wait for it to complete.";
  }

  isRunning = true;
  try {
    delete process.env.CLAUDECODE;
    await runAgent();
    await buildPages();
    return "Digest generated successfully. Use list_digests or get_digest to see results.";
  } catch (err) {
    return `Digest generation failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    isRunning = false;
  }
}
