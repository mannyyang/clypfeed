import { listDigestDates, getFullDigest, searchItems } from "../db.js";
import type { DigestItem } from "../types.js";
import { CATEGORY_ORDER, CATEGORY_LABELS, groupByCategory } from "../types.js";

function formatGroupedItems(items: DigestItem[]): string {
  const grouped = groupByCategory(items);
  const sections: string[] = [];
  let idx = 1;

  for (const cat of CATEGORY_ORDER) {
    const catItems = grouped.get(cat);
    if (!catItems || catItems.length === 0) continue;

    sections.push(`=== ${CATEGORY_LABELS[cat].toUpperCase()} ===`);
    for (const item of catItems) {
      let entry = `${idx}. ${item.headline}`;
      if (item.tldr) {
        entry += `\n   TL;DR: ${item.tldr}`;
      }
      entry += `\n   ${item.summary}`;
      entry += `\n   Source: ${item.sourceUrl}${item.source ? ` (via ${item.source})` : ""}`;
      sections.push(entry);
      idx++;
    }
    sections.push("");
  }

  return sections.join("\n");
}

export async function listDigests(limit: number = 20): Promise<string> {
  const dates = listDigestDates(limit);
  if (dates.length === 0) return "No digests found.";
  return `Available digests (${dates.length}):\n${dates.map((d) => `- ${d}`).join("\n")}`;
}

export async function getDigest(date: string): Promise<string> {
  const digest = getFullDigest(date);
  if (!digest) return `No digest found for ${date}.`;

  const items = formatGroupedItems(digest.items);
  return `Digest for ${digest.date}\nSignal: ${digest.signal}\n\n${items}`;
}

export async function searchDigests(
  query: string,
  days: number = 7
): Promise<string> {
  const results = searchItems(query, days);
  if (results.length === 0)
    return `No results for "${query}" in the last ${days} days.`;

  const lines = results.map(
    (r) => `[${r.digest_date}] ${r.headline}\n  ${r.summary}\n  ${r.sourceUrl}`
  );

  return `Found ${results.length} result(s) for "${query}":\n\n${lines.join("\n\n")}`;
}
