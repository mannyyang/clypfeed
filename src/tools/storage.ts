import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";

export const saveDigestTool = tool(
  "save_digest",
  "Save the final AI news digest as a JSON file to the output directory. The digest parameter should be a valid JSON string.",
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

    return {
      content: [
        {
          type: "text" as const,
          text: `Digest saved to ${filePath}`,
        },
      ],
    };
  }
);
