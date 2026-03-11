import "dotenv/config";

import { listDigests, getDigest, searchDigests } from "./tools/digest.js";
import { listFeeds, addFeed, removeFeed } from "./tools/feeds.js";
import { runAgent } from "./agent.js";
import { buildPages } from "./pages.js";

const USAGE = `ClypFeed CLI - AI news digest aggregator

Usage: clypfeed <command> [subcommand] [args] [flags]

Commands:
  run                               Generate a new digest now
  list [--limit N]                  List available digests (default: 20)
  get <date>                        Get digest for a specific date (YYYY-MM-DD)
  search <query> [--days N]         Search digests by keyword (default: 7 days)
  pages                             Build HTML pages from digests

  feed list                         List configured RSS feeds
  feed add <name> <url>             Add an RSS feed
  feed remove <name>                Remove an RSS feed by name

Examples:
  clypfeed run
  clypfeed list
  clypfeed get 2026-03-10
  clypfeed search "Claude" --days 14
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
    case "run": {
      delete process.env.CLAUDECODE;
      await runAgent();
      await buildPages();
      console.log("Digest generated and pages built.");
      break;
    }

    case "list": {
      const limit = Number(flag("limit", "20"));
      console.log(await listDigests(limit));
      break;
    }

    case "get": {
      const date = sub;
      if (!date) {
        console.error("Usage: clypfeed get <YYYY-MM-DD>");
        process.exit(1);
      }
      console.log(await getDigest(date));
      break;
    }

    case "search": {
      const query = sub;
      if (!query) {
        console.error("Usage: clypfeed search <query> [--days N]");
        process.exit(1);
      }
      const days = Number(flag("days", "7"));
      console.log(await searchDigests(query, days));
      break;
    }

    case "pages": {
      await buildPages();
      console.log("Pages built successfully.");
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
