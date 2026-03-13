import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { saveFullDigest, getPublishedUrls } from "../db.js";
import type { Digest } from "../types.js";

export const getPublishedTool = tool(
  "get_published",
  "Get previously published stories (headline + URL). Use this before creating a digest to avoid duplicates. Compare headlines semantically — different wording about the same event counts as a duplicate.",
  {},
  async () => {
    const entries = getPublishedUrls();
    return {
      content: [
        {
          type: "text" as const,
          text: entries.length > 0
            ? `Previously published stories (${entries.length}):\n${entries.map((e) => `- [${e.date}] ${e.headline} (${e.url})`).join("\n")}`
            : "No previously published stories.",
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } }
);

export const saveDigestTool = tool(
  "save_digest",
  "Save the final AI news digest. The digest parameter should be a valid JSON string. This also records published URLs to prevent duplicates in future runs.",
  {
    date: z.string().describe("Date string in YYYY-MM-DD format"),
    digest: z.string().describe("JSON string of the digest object with items array and signal"),
  },
  async ({ date, digest }) => {
    let parsed: Digest;
    try {
      parsed = JSON.parse(digest);
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Invalid JSON in digest parameter. Please provide valid JSON.",
          },
        ],
        isError: true,
      };
    }

    parsed.date = date;
    saveFullDigest(parsed);

    return {
      content: [
        {
          type: "text" as const,
          text: `Digest saved to SQLite for ${date}. Tracked ${parsed.items.length} stories as published.`,
        },
      ],
    };
  }
);
