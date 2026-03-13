import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getOutputDir } from "./config.js";
import { saveFullDigest, seedDefaultFeeds, closeDb, getFeedCount, addFeed } from "./db.js";
import { DEFAULT_FEEDS } from "./rss.js";
import type { Digest } from "./types.js";

export async function migrateJsonToSqlite(): Promise<void> {
  const outputDir = getOutputDir();

  // 1. Migrate digest JSON files
  const files = (await readdir(outputDir)).filter(
    (f: string) =>
      f.endsWith(".json") &&
      f !== "published.json" &&
      f !== "config.json" &&
      /^\d{4}-\d{2}-\d{2}\.json$/.test(f)
  );

  let digestCount = 0;
  let itemCount = 0;

  for (const file of files) {
    try {
      const raw = await readFile(join(outputDir, file), "utf-8");
      const digest: Digest = JSON.parse(raw);
      saveFullDigest(digest);
      digestCount++;
      itemCount += digest.items.length;
      console.error(`  Migrated ${file} (${digest.items.length} items)`);
    } catch (err) {
      console.error(`  Skipped ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Migrate custom feeds from config.json
  try {
    const configRaw = await readFile(join(outputDir, "config.json"), "utf-8");
    const config = JSON.parse(configRaw);
    if (Array.isArray(config.feeds)) {
      for (const feed of config.feeds) {
        if (feed.name && feed.url) {
          addFeed(feed.name, feed.url);
        }
      }
      console.error(`  Migrated ${config.feeds.length} custom feeds from config.json`);
    }
  } catch {
    // No config.json or invalid — that's fine
  }

  // 3. Seed default feeds if none exist
  if (getFeedCount() === 0) {
    seedDefaultFeeds(DEFAULT_FEEDS);
    console.error(`  Seeded ${DEFAULT_FEEDS.length} default feeds`);
  }

  console.error(`\nMigration complete: ${digestCount} digests, ${itemCount} items`);

  closeDb();
}
