export interface RssItem {
  title: string;
  link: string;
  date: string;
  source: string;
}

import type { FeedEntry } from "./config.js";
import { listFeeds, ensureFeeds } from "./db.js";

// Curated high-signal AI/engineering feeds (all validated)
export const DEFAULT_FEEDS: FeedEntry[] = [
  // Lab & platform blogs
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml" },
  { name: "Google AI Blog", url: "http://googleaiblog.blogspot.com/atom.xml" },
  { name: "DeepMind Blog", url: "https://deepmind.com/blog/feed/basic/" },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
  { name: "LangChain Blog", url: "https://blog.langchain.dev/rss/" },
  { name: "Databricks", url: "https://www.databricks.com/feed" },
  // Newsletters (engineering + Claude focused)
  { name: "TLDR", url: "https://tldr.tech/rss" },
  { name: "Import AI", url: "https://jack-clark.net/feed/" },
  { name: "Latent Space", url: "https://www.latent.space/feed" },
  { name: "TheSequence", url: "https://thesequence.substack.com/feed" },
  { name: "Interconnects", url: "https://www.interconnects.ai/feed" },
  { name: "Ben's Bites", url: "https://www.bensbites.com/feed" },
  // Reddit
  { name: "r/ClaudeAI", url: "https://www.reddit.com/r/ClaudeAI/.rss" },
  { name: "r/ClaudeCode", url: "https://www.reddit.com/r/ClaudeCode/.rss" },
  // Individual experts
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
  // Changelogs (Claude-specific feature detection)
  { name: "Anthropic Changelog", url: "https://docs.anthropic.com/en/changelog/rss.xml" },
  { name: "Claude Code Changelog", url: "https://code.claude.com/docs/en/changelog.xml" },
];

function extractItems(xml: string, sourceName: string): RssItem[] {
  const items: RssItem[] = [];

  // Match RSS <item> or Atom <entry> blocks
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title =
      block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";
    const link =
      block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/i)?.[1] ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ||
      "";
    const date =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ||
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() ||
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() ||
      "";

    if (title && link) {
      items.push({ title, link, date, source: sourceName });
    }
  }

  return items;
}

function isRecent(dateStr: string, hours: number): boolean {
  if (!dateStr) return true; // include if no date
  try {
    const itemDate = new Date(dateStr);
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return itemDate.getTime() > cutoff;
  } catch {
    return true;
  }
}

export async function fetchRssFeeds(
  hours: number = 48,
  feeds?: FeedEntry[]
): Promise<RssItem[]> {
  let feedList = feeds;
  if (!feedList) {
    try {
      ensureFeeds(DEFAULT_FEEDS);
      const dbFeeds = listFeeds();
      feedList = dbFeeds.map((f) => ({ name: f.name, url: f.url }));
    } catch {
      feedList = DEFAULT_FEEDS;
    }
  }

  const allItems: RssItem[] = [];

  const results = await Promise.allSettled(
    feedList.map(async (feed) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "ClypFeed/1.0 (AI News Aggregator)" },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return [];

        const xml = await res.text();
        return extractItems(xml, feed.name);
      } catch {
        clearTimeout(timeout);
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  return allItems
    .filter((item) => isRecent(item.date, hours))
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
}
