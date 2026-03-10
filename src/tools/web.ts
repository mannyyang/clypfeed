import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { parseEmailHtml } from "../parser.js";
import { fetchRssFeeds } from "../rss.js";

const fetchWebpageTool = tool(
  "fetch_webpage",
  "Fetch and parse a webpage URL. Returns cleaned text content with links preserved as markdown. Use this to scrape news sources like Anthropic's newsroom or engineering blog.",
  { url: z.string().url().describe("The URL to fetch") },
  async ({ url }) => {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "ClypFeed/1.0 (AI News Aggregator)",
      },
    });

    if (!res.ok) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to fetch ${url}: ${res.status} ${res.statusText}`,
          },
        ],
      };
    }

    const html = await res.text();
    const parsed = parseEmailHtml(html);

    return {
      content: [
        {
          type: "text" as const,
          text: `Source: ${url}\n\n${parsed}`,
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true, openWorldHint: true } }
);

const fetchRssTool = tool(
  "fetch_rss",
  "Fetch recent items from curated AI news RSS feeds (Anthropic, OpenAI, Google, DeepMind, TechCrunch, Ars Technica, Latent Space, Simon Willison, etc). Returns titles, links, dates, and sources. Use this as a primary news source alongside emails.",
  { hours: z.number().default(48).describe("How many hours back to include") },
  async ({ hours }) => {
    const items = await fetchRssFeeds(hours);
    if (items.length === 0) {
      return {
        content: [
          { type: "text" as const, text: "No recent RSS items found." },
        ],
      };
    }

    const text = items
      .map((item) => `[${item.source}] ${item.title}\n  ${item.link}\n  ${item.date}`)
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${items.length} recent RSS items:\n\n${text}`,
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true, openWorldHint: true } }
);

export { fetchWebpageTool, fetchRssTool };
