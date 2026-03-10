import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { listDigests, getDigest, searchDigests } from "./tools/digest.js";
import {
  startScheduler,
  stopScheduler,
  getScheduleStatus,
  setSchedule,
  runDigestNow,
} from "./tools/schedule.js";
import { listFeeds, addFeed, removeFeed } from "./tools/feeds.js";

const DIGEST_SYSTEM_PROMPT = `You are an AI news aggregator agent. Your job is to process newsletter emails and produce a daily AI news digest.

Instructions:
1. Use get_published to check previously published stories — skip any story that covers the same event, even if the headline or wording is different
2. Use fetch_rss to get recent items from curated AI news RSS feeds
3. Use fetch_emails to get emails from the last 24 hours
4. Scan the subject lines and senders to identify AI/tech newsletters
5. Use get_email to read the content of relevant newsletters
6. Use fetch_webpage to check these official sources for recent announcements:
   - https://www.anthropic.com/news (Anthropic newsroom)
   - https://www.anthropic.com/engineering (Anthropic engineering blog)
   - https://github.com/anthropics/claude-code/releases (Claude Code changelog)
7. Extract AI/ML news items, with this priority order:
   a. Claude model updates, releases, or capability changes (highest priority)
   b. Anthropic product news (Claude Code, Cowork, Claude.ai, MCP)
   c. Anthropic company news (funding, partnerships, policy)
   d. Direct competitive moves affecting Claude's positioning (OpenAI, Google, etc.)
8. Deduplicate stories that appear in multiple newsletters, RSS feeds, or web sources
9. Rank items by priority, keep top 3-5 items max
10. For each item, assign a category from: claude-updates, anthropic-product, anthropic-company, competitive, ecosystem. Set source to the name of the newsletter, blog, or outlet where you found it (e.g. "Axios", "OpenAI Blog", "TLDR"). If the source article has a prominent image (og:image, hero image, or thumbnail), include its URL as imageUrl; otherwise omit it.
11. Use save_digest to save the result as JSON with the correct schema

Rules:
- Skip anything older than 24 hours
- Skip tutorials, opinion pieces, and "how to use" content
- Skip minor community posts unless they reveal a real product change
- If fewer than 2 genuinely newsworthy items, set signal to "Quiet day — nothing major to report."
- Keep summaries concise and factual`;

const server = new McpServer(
  { name: "clypfeed", version: "1.0.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// --- Digest Query Tools ---

server.tool(
  "list_digests",
  "List available digest dates, most recent first.",
  { limit: z.number().default(20).describe("Max number of digests to list") },
  async ({ limit }) => ({
    content: [{ type: "text", text: await listDigests(limit) }],
  })
);

server.tool(
  "get_digest",
  "Read a specific day's digest by date. Returns headlines, summaries, sources, and the daily signal.",
  { date: z.string().describe("Date in YYYY-MM-DD format") },
  async ({ date }) => ({
    content: [{ type: "text", text: await getDigest(date) }],
  })
);

server.tool(
  "search_digests",
  "Search digest items by keyword across recent digests.",
  {
    query: z.string().describe("Search keyword or phrase"),
    days: z.number().default(7).describe("How many days back to search"),
  },
  async ({ query, days }) => ({
    content: [{ type: "text", text: await searchDigests(query, days) }],
  })
);

// --- Schedule Management Tools ---

server.tool(
  "get_schedule",
  "Get the current background digest schedule status (cron expression, active/inactive).",
  {},
  async () => ({
    content: [{ type: "text", text: getScheduleStatus() }],
  })
);

server.tool(
  "set_schedule",
  'Set the background cron schedule for automatic digest generation. Examples: "0 8 * * *" (daily 8am), "0 9 * * 1-5" (weekdays 9am).',
  {
    cron: z.string().describe("Cron expression for the schedule"),
  },
  async ({ cron }) => ({
    content: [{ type: "text", text: await setSchedule(cron) }],
  })
);

server.tool(
  "stop_schedule",
  "Stop the background digest schedule.",
  {},
  async () => {
    stopScheduler();
    return { content: [{ type: "text", text: "Schedule stopped." }] };
  }
);

server.tool(
  "run_digest_now",
  "Trigger an immediate digest generation run. This fetches emails, RSS feeds, scrapes web sources, and uses Claude to produce a digest. May take a few minutes.",
  {},
  async () => ({
    content: [{ type: "text", text: await runDigestNow() }],
  })
);

// --- Feed Management Tools ---

server.tool(
  "list_feeds",
  "List all configured RSS feeds (name and URL).",
  {},
  async () => ({
    content: [{ type: "text", text: await listFeeds() }],
  })
);

server.tool(
  "add_feed",
  "Add a new RSS feed to the configuration.",
  {
    name: z.string().describe("Display name for the feed (e.g. 'TechCrunch AI')"),
    url: z.string().url().describe("RSS feed URL"),
  },
  async ({ name, url }) => ({
    content: [{ type: "text", text: await addFeed(name, url) }],
  })
);

server.tool(
  "remove_feed",
  "Remove an RSS feed by name.",
  {
    name: z.string().describe("Name of the feed to remove"),
  },
  async ({ name }) => ({
    content: [{ type: "text", text: await removeFeed(name) }],
  })
);

// --- Prompt: generate-digest ---

server.prompt(
  "generate-digest",
  "Instructions for generating an AI news digest. Use this prompt when asking Claude to run the digest pipeline.",
  async () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: DIGEST_SYSTEM_PROMPT,
        },
      },
    ],
  })
);

// --- Resource: latest digest ---

server.resource(
  "latest-digest",
  "digest://latest",
  { description: "The most recent daily AI news digest" },
  async () => {
    const text = await getDigest(new Date().toISOString().split("T")[0]);
    return {
      contents: [
        {
          uri: "digest://latest",
          mimeType: "text/plain",
          text,
        },
      ],
    };
  }
);

// --- Start ---

async function main() {
  // Start background scheduler
  try {
    await startScheduler();
    console.error("[clypfeed] Background scheduler initialized");
  } catch (err) {
    console.error("[clypfeed] Scheduler init failed (continuing without schedule):", err);
  }

  // Connect MCP server via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[clypfeed] MCP server connected via stdio");
}

main().catch((err) => {
  console.error("[clypfeed] Fatal error:", err);
  process.exit(1);
});
