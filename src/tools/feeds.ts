import { loadConfig, saveConfig, type FeedEntry } from "../config.js";
import { DEFAULT_FEEDS } from "../rss.js";

export async function listFeeds(): Promise<string> {
  const config = await loadConfig();
  const feeds: FeedEntry[] =
    config.feeds.length > 0 ? config.feeds : DEFAULT_FEEDS;

  const lines = feeds.map((f) => `- ${f.name}: ${f.url}`);
  const source =
    config.feeds.length > 0 ? "custom (saved in config)" : "default";

  return `RSS Feeds (${feeds.length}, ${source}):\n${lines.join("\n")}`;
}

export async function addFeed(name: string, url: string): Promise<string> {
  const config = await loadConfig();

  // Initialize from defaults if no custom feeds yet
  if (config.feeds.length === 0) {
    config.feeds = [...DEFAULT_FEEDS];
  }

  const existing = config.feeds.find(
    (f) => f.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    return `Feed "${name}" already exists (${existing.url}). Remove it first to update.`;
  }

  config.feeds.push({ name, url });
  await saveConfig(config);

  return `Added feed "${name}" (${url}). Total feeds: ${config.feeds.length}.`;
}

export async function removeFeed(name: string): Promise<string> {
  const config = await loadConfig();

  // Initialize from defaults if no custom feeds yet
  if (config.feeds.length === 0) {
    config.feeds = [...DEFAULT_FEEDS];
  }

  const idx = config.feeds.findIndex(
    (f) => f.name.toLowerCase() === name.toLowerCase()
  );
  if (idx === -1) {
    const available = config.feeds.map((f) => f.name).join(", ");
    return `Feed "${name}" not found. Available: ${available}`;
  }

  const removed = config.feeds.splice(idx, 1)[0];
  await saveConfig(config);

  return `Removed feed "${removed.name}". Remaining feeds: ${config.feeds.length}.`;
}
