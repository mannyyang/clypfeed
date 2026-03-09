import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { parseEmailHtml } from "../parser.js";

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
  { annotations: { readOnly: true, openWorld: true } }
);

export { fetchWebpageTool };
