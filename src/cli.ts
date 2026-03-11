import "dotenv/config";

import { listDigests, getDigest, searchDigests } from "./tools/digest.js";
import {
  stopScheduler,
  getScheduleStatus,
  setSchedule,
  runDigestNow,
} from "./tools/schedule.js";
import { listFeeds, addFeed, removeFeed } from "./tools/feeds.js";
import { buildPages } from "./pages.js";
import { loadConfig, saveConfig } from "./config.js";

const USAGE = `ClypFeed CLI - AI news digest aggregator

Usage: clypfeed <command> [subcommand] [args] [flags]

Commands:
  digest list [--limit N]           List available digests (default: 20)
  digest get <date>                 Get digest for a specific date (YYYY-MM-DD)
  digest search <query> [--days N]  Search digests by keyword (default: 7 days)
  digest run                        Generate a new digest now

  schedule status                   Show current schedule configuration
  schedule set <cron>               Set digest schedule (e.g. "0 8 * * *")
  schedule stop                     Clear the digest schedule

  feed list                         List configured RSS feeds
  feed add <name> <url>             Add an RSS feed
  feed remove <name>                Remove an RSS feed by name

  pages                             Build HTML pages from digests

Examples:
  clypfeed digest list
  clypfeed digest get 2026-03-10
  clypfeed digest search "Claude" --days 14
  clypfeed digest run
  clypfeed schedule set "0 9 * * 1-5"
  clypfeed feed add "TechCrunch" "https://techcrunch.com/feed"`;

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < process.argv.length
    ? process.argv[i + 1]
    : fallback;
}

async function main() {
  const [cmd, sub, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(USAGE);
    return;
  }

  switch (cmd) {
    case "digest": {
      switch (sub) {
        case "list": {
          const limit = Number(flag("limit", "20"));
          console.log(await listDigests(limit));
          break;
        }
        case "get": {
          const date = rest[0];
          if (!date) {
            console.error("Usage: clypfeed digest get <YYYY-MM-DD>");
            process.exit(1);
          }
          console.log(await getDigest(date));
          break;
        }
        case "search": {
          const query = rest[0];
          if (!query) {
            console.error("Usage: clypfeed digest search <query> [--days N]");
            process.exit(1);
          }
          const days = Number(flag("days", "7"));
          console.log(await searchDigests(query, days));
          break;
        }
        case "run": {
          console.log(await runDigestNow());
          break;
        }
        default:
          console.error(`Unknown digest subcommand: ${sub ?? "(none)"}\n`);
          console.log(USAGE);
          process.exit(1);
      }
      break;
    }

    case "schedule": {
      switch (sub) {
        case "status": {
          const status = JSON.parse(getScheduleStatus());
          const config = await loadConfig();
          status.configuredCron = config.schedule || "(none)";
          console.log(JSON.stringify(status, null, 2));
          break;
        }
        case "set": {
          const cron = rest[0];
          if (!cron) {
            console.error('Usage: clypfeed schedule set <cron>');
            process.exit(1);
          }
          console.log(await setSchedule(cron));
          break;
        }
        case "stop": {
          stopScheduler();
          const config = await loadConfig();
          config.schedule = "";
          await saveConfig(config);
          console.log("Schedule stopped and cleared from config.");
          break;
        }
        default:
          console.error(`Unknown schedule subcommand: ${sub ?? "(none)"}\n`);
          console.log(USAGE);
          process.exit(1);
      }
      break;
    }

    case "feed": {
      switch (sub) {
        case "list": {
          console.log(await listFeeds());
          break;
        }
        case "add": {
          const name = rest[0];
          const url = rest[1];
          if (!name || !url) {
            console.error("Usage: clypfeed feed add <name> <url>");
            process.exit(1);
          }
          console.log(await addFeed(name, url));
          break;
        }
        case "remove": {
          const name = rest[0];
          if (!name) {
            console.error("Usage: clypfeed feed remove <name>");
            process.exit(1);
          }
          console.log(await removeFeed(name));
          break;
        }
        default:
          console.error(`Unknown feed subcommand: ${sub ?? "(none)"}\n`);
          console.log(USAGE);
          process.exit(1);
      }
      break;
    }

    case "pages": {
      await buildPages();
      console.log("Pages built successfully.");
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(USAGE);
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
