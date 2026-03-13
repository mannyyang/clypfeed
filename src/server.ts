import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { listDigests, getDigest, searchDigests } from "./tools/digest.js";
import { listFeeds, addFeed, removeFeed } from "./tools/feeds.js";
import { runAgent } from "./agent.js";
import { buildPages } from "./pages.js";

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

// --- Digest Generation Tool ---

server.tool(
  "run_digest_now",
  "Trigger an immediate digest generation run. This fetches emails, RSS feeds, scrapes web sources, and uses Claude to produce a digest. May take a few minutes.",
  {},
  async () => {
    try {
      await runAgent();
      await buildPages();
      return { content: [{ type: "text", text: "Digest generated successfully. Use list_digests or get_digest to see results." }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Digest generation failed: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  }
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
          text: "Run the digest pipeline by calling run_digest_now.",
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[clypfeed] MCP server connected via stdio");
}

main().catch((err) => {
  console.error("[clypfeed] Fatal error:", err);
  process.exit(1);
});
