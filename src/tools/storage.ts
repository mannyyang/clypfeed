import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

interface PublishedEntry {
  headline: string;
  url: string;
  date: string;
}

const publishedPath = join(process.cwd(), "output", "published.json");

async function loadPublished(): Promise<PublishedEntry[]> {
  try {
    const data = await readFile(publishedPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function appendPublished(entries: PublishedEntry[]): Promise<void> {
  const existing = await loadPublished();
  const existingUrls = new Set(existing.map((e) => e.url));
  const newEntries = entries.filter((e) => !existingUrls.has(e.url));
  await writeFile(
    publishedPath,
    JSON.stringify([...existing, ...newEntries], null, 2),
    "utf-8"
  );
}

export const getPublishedTool = tool(
  "get_published",
  "Get previously published stories (headline + URL). Use this before creating a digest to avoid duplicates. Compare headlines semantically — different wording about the same event counts as a duplicate.",
  {},
  async () => {
    const entries = await loadPublished();
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
  { annotations: { readOnly: true } }
);

export const saveDigestTool = tool(
  "save_digest",
  "Save the final AI news digest as a JSON file to the output directory. The digest parameter should be a valid JSON string. This also records published URLs to prevent duplicates in future runs.",
  {
    date: z.string().describe("Date string in YYYY-MM-DD format"),
    digest: z.string().describe("JSON string of the digest object with items array and signal"),
  },
  async ({ date, digest }) => {
    const outputDir = join(process.cwd(), "output");
    const filePath = join(outputDir, `${date}.json`);

    await mkdir(outputDir, { recursive: true });

    // Validate JSON
    let parsed;
    try {
      parsed = JSON.parse(digest);
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Invalid JSON in digest parameter. Please provide valid JSON.`,
          },
        ],
        isError: true,
      };
    }

    // Write formatted JSON
    await writeFile(filePath, JSON.stringify(parsed, null, 2), "utf-8");

    // Track published stories
    const entries: PublishedEntry[] = (parsed.items || [])
      .filter((item: any) => item.sourceUrl && item.headline)
      .map((item: any) => ({
        headline: item.headline,
        url: item.sourceUrl,
        date,
      }));
    if (entries.length > 0) {
      await appendPublished(entries);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Digest saved to ${filePath}. Tracked ${entries.length} stories as published.`,
        },
      ],
    };
  }
);
