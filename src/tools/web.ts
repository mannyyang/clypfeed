import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { parseEmailHtml } from "../parser.js";
import { fetchRssFeeds } from "../rss.js";
import { getDocsSnapshot, saveDocsSnapshot } from "../db.js";

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

function diffContent(oldText: string, newText: string): string {
  const oldLines = new Set(oldText.split("\n").map((l) => l.trim()).filter(Boolean));
  const newLines = newText.split("\n");

  const added: string[] = [];
  let inNewBlock = false;
  let blockLines: string[] = [];

  for (const line of newLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inNewBlock && blockLines.length > 0) {
        added.push(blockLines.join("\n"));
        blockLines = [];
        inNewBlock = false;
      }
      continue;
    }
    if (!oldLines.has(trimmed)) {
      inNewBlock = true;
      blockLines.push(line);
    } else {
      if (inNewBlock && blockLines.length > 0) {
        added.push(blockLines.join("\n"));
        blockLines = [];
      }
      inNewBlock = false;
    }
  }
  if (blockLines.length > 0) {
    added.push(blockLines.join("\n"));
  }

  return added.join("\n\n---\n\n");
}

const fetchDocsDiffTool = tool(
  "fetch_docs_diff",
  "Fetch a docs page and compare against the last stored snapshot. Returns ONLY new/changed content. Use this for Claude Code docs pages to detect new features, commands, or settings that were recently added. On first run for a URL, all content is returned as 'new'.",
  { url: z.string().url().describe("The docs page URL to check for changes") },
  async ({ url }) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "ClypFeed/1.0 (AI News Aggregator)" },
    });

    if (!res.ok) {
      return {
        content: [
          { type: "text" as const, text: `Failed to fetch ${url}: ${res.status} ${res.statusText}` },
        ],
      };
    }

    const html = await res.text();
    const currentContent = parseEmailHtml(html);
    const previousContent = getDocsSnapshot(url);

    // Save the new snapshot
    saveDocsSnapshot(url, currentContent);

    if (!previousContent) {
      return {
        content: [
          {
            type: "text" as const,
            text: `First snapshot of ${url} — all content treated as new. Review for recently added features:\n\n${currentContent}`,
          },
        ],
      };
    }

    const diff = diffContent(previousContent, currentContent);

    if (!diff.trim()) {
      return {
        content: [
          { type: "text" as const, text: `No changes detected on ${url} since last check.` },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Changes detected on ${url}:\n\n${diff}`,
        },
      ],
    };
  },
  { annotations: { readOnlyHint: false, openWorldHint: true } }
);

export { fetchWebpageTool, fetchRssTool, fetchDocsDiffTool };
