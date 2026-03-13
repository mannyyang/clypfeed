import {
  listFeeds as dbListFeeds,
  addFeed as dbAddFeed,
  removeFeed as dbRemoveFeed,
  ensureFeeds,
  getFeedCount,
} from "../db.js";
import { DEFAULT_FEEDS } from "../rss.js";

export async function listFeeds(): Promise<string> {
  ensureFeeds(DEFAULT_FEEDS);
  const feeds = dbListFeeds();
  const lines = feeds.map(
    (f) => `- ${f.name}: ${f.url}${f.is_default ? "" : " (custom)"}`
  );
  return `RSS Feeds (${feeds.length}):\n${lines.join("\n")}`;
}

export async function addFeed(name: string, url: string): Promise<string> {
  ensureFeeds(DEFAULT_FEEDS);
  dbAddFeed(name, url);
  const count = getFeedCount();
  return `Added feed "${name}" (${url}). Total feeds: ${count}.`;
}

export async function removeFeed(name: string): Promise<string> {
  ensureFeeds(DEFAULT_FEEDS);
  const removed = dbRemoveFeed(name);
  if (!removed) {
    const feeds = dbListFeeds();
    const available = feeds.map((f) => f.name).join(", ");
    return `Feed "${name}" not found or is a default feed. Available custom feeds: ${available}`;
  }
  const count = getFeedCount();
  return `Removed feed "${name}". Remaining feeds: ${count}.`;
}
