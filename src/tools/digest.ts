import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getOutputDir } from "../config.js";
import type { Digest } from "../types.js";

export async function listDigests(limit: number = 20): Promise<string> {
  const outputDir = getOutputDir();
  let files: string[];
  try {
    files = (await readdir(outputDir)).filter(
      (f) => f.endsWith(".json") && f !== "published.json" && f !== "config.json"
    );
  } catch {
    return "No digests found. The output directory does not exist yet.";
  }

  if (files.length === 0) return "No digests found.";

  const dates = files
    .map((f) => f.replace(".json", ""))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  return `Available digests (${dates.length}):\n${dates.map((d) => `- ${d}`).join("\n")}`;
}

export async function getDigest(date: string): Promise<string> {
  const outputDir = getOutputDir();
  const filePath = join(outputDir, `${date}.json`);

  try {
    const data = await readFile(filePath, "utf-8");
    const digest: Digest = JSON.parse(data);

    const items = digest.items
      .map(
        (item, i) =>
          `${i + 1}. [${item.category || "general"}] ${item.headline}\n   ${item.summary}\n   Source: ${item.sourceUrl}${item.source ? ` (via ${item.source})` : ""}`
      )
      .join("\n\n");

    return `Digest for ${digest.date}\nSignal: ${digest.signal}\n\n${items}`;
  } catch {
    return `No digest found for ${date}.`;
  }
}

export async function searchDigests(
  query: string,
  days: number = 7
): Promise<string> {
  const outputDir = getOutputDir();
  let files: string[];
  try {
    files = (await readdir(outputDir)).filter(
      (f) => f.endsWith(".json") && f !== "published.json" && f !== "config.json"
    );
  } catch {
    return "No digests found.";
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const recentFiles = files
    .map((f) => f.replace(".json", ""))
    .filter((date) => date >= cutoffStr)
    .sort((a, b) => b.localeCompare(a));

  const queryLower = query.toLowerCase();
  const matches: string[] = [];

  for (const date of recentFiles) {
    try {
      const data = await readFile(join(outputDir, `${date}.json`), "utf-8");
      const digest: Digest = JSON.parse(data);

      for (const item of digest.items) {
        if (
          item.headline.toLowerCase().includes(queryLower) ||
          item.summary.toLowerCase().includes(queryLower)
        ) {
          matches.push(
            `[${date}] ${item.headline}\n  ${item.summary}\n  ${item.sourceUrl}`
          );
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  if (matches.length === 0)
    return `No results for "${query}" in the last ${days} days.`;

  return `Found ${matches.length} result(s) for "${query}":\n\n${matches.join("\n\n")}`;
}
