import Database from "better-sqlite3";
import { join } from "node:path";
import { getOutputDir } from "./config.js";
import type { DigestItem, Digest, DigestCategory } from "./types.js";
import { DEFAULT_CATEGORY } from "./types.js";

const DB_FILE = join(getOutputDir(), "clypfeed.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS digests (
      date          TEXT PRIMARY KEY,
      signal        TEXT NOT NULL,
      item_count    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      digest_date   TEXT NOT NULL REFERENCES digests(date),
      headline      TEXT NOT NULL,
      tldr          TEXT,
      summary       TEXT NOT NULL,
      source_url    TEXT NOT NULL,
      priority      INTEGER NOT NULL DEFAULT 0,
      category      TEXT NOT NULL DEFAULT 'ecosystem',
      source_name   TEXT,
      image_url     TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_url, digest_date)
    );

    CREATE TABLE IF NOT EXISTS feeds (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      url           TEXT NOT NULL,
      is_default    INTEGER NOT NULL DEFAULT 0,
      enabled       INTEGER NOT NULL DEFAULT 1,
      last_fetched  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS docs_snapshots (
      url           TEXT PRIMARY KEY,
      content       TEXT NOT NULL,
      last_checked  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_items_date ON items(digest_date);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    CREATE INDEX IF NOT EXISTS idx_items_source_url ON items(source_url);
  `);

  process.on("exit", closeDb);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// --- Row types ---

interface DigestRow {
  date: string;
  signal: string;
  item_count: number;
}

interface ItemRow {
  digest_date?: string;
  headline: string;
  tldr: string | null;
  summary: string;
  source_url: string;
  priority: number;
  category: string;
  source_name: string | null;
  image_url: string | null;
}

interface CountRow {
  count: number;
}

// --- Digest CRUD ---

export function upsertDigest(date: string, signal: string, itemCount: number): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO digests (date, signal, item_count)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET signal = excluded.signal, item_count = excluded.item_count
  `).run(date, signal, itemCount);
}

export function getDigestMeta(date: string): DigestRow | null {
  const d = getDb();
  return d.prepare("SELECT date, signal, item_count FROM digests WHERE date = ?").get(date) as DigestRow | undefined ?? null;
}

export function listDigestDates(limit: number = 20): string[] {
  const d = getDb();
  const rows = d.prepare("SELECT date FROM digests ORDER BY date DESC LIMIT ?").all(limit) as Array<{ date: string }>;
  return rows.map((r) => r.date);
}

// --- Item CRUD ---

export function insertItem(digestDate: string, item: DigestItem, stmt?: Database.Statement): void {
  const s = stmt || getDb().prepare(`
    INSERT OR IGNORE INTO items (digest_date, headline, tldr, summary, source_url, priority, category, source_name, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  s.run(
    digestDate,
    item.headline,
    item.tldr || null,
    item.summary,
    item.sourceUrl,
    item.priority,
    item.category || DEFAULT_CATEGORY,
    item.source || null,
    item.imageUrl || null,
  );
}

export function getItemsByDate(date: string): DigestItem[] {
  const d = getDb();
  const rows = d.prepare(
    "SELECT headline, tldr, summary, source_url, priority, category, source_name, image_url FROM items WHERE digest_date = ? ORDER BY priority ASC"
  ).all(date) as ItemRow[];

  return rows.map(rowToDigestItem);
}

export function getItemsByCategory(category: string, limit: number = 50): DigestItem[] {
  const d = getDb();
  const rows = d.prepare(
    "SELECT headline, tldr, summary, source_url, priority, category, source_name, image_url FROM items WHERE category = ? ORDER BY digest_date DESC, priority ASC LIMIT ?"
  ).all(category, limit) as ItemRow[];

  return rows.map(rowToDigestItem);
}

export function searchItems(query: string, days: number = 7): Array<DigestItem & { digest_date: string }> {
  const d = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const pattern = `%${query}%`;
  const rows = d.prepare(`
    SELECT digest_date, headline, tldr, summary, source_url, priority, category, source_name, image_url
    FROM items
    WHERE (headline LIKE ? OR summary LIKE ?) AND digest_date >= ?
    ORDER BY digest_date DESC, priority ASC
  `).all(pattern, pattern, cutoffStr) as (ItemRow & { digest_date: string })[];

  return rows.map((r) => ({
    ...rowToDigestItem(r),
    digest_date: r.digest_date,
  }));
}

export function getPublishedUrls(): Array<{ headline: string; url: string; date: string; source?: string }> {
  const d = getDb();
  // Only look back 60 days for dedup — older stories won't resurface
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const rows = d.prepare(
    "SELECT headline, source_url, digest_date, source_name FROM items WHERE digest_date >= ? ORDER BY digest_date DESC"
  ).all(cutoffStr) as Array<{ headline: string; source_url: string; digest_date: string; source_name: string | null }>;

  return rows.map((r) => ({
    headline: r.headline,
    url: r.source_url,
    date: r.digest_date,
    ...(r.source_name ? { source: r.source_name } : {}),
  }));
}

// --- Full digest read ---

export function getFullDigest(date: string): Digest | null {
  const meta = getDigestMeta(date);
  if (!meta) return null;
  const items = getItemsByDate(date);
  return { date: meta.date, items, signal: meta.signal };
}

// --- Save full digest (transaction) ---

export function saveFullDigest(digest: Digest): void {
  const d = getDb();
  const insertStmt = d.prepare(`
    INSERT OR IGNORE INTO items (digest_date, headline, tldr, summary, source_url, priority, category, source_name, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = d.transaction(() => {
    upsertDigest(digest.date, digest.signal, digest.items.length);
    // Delete existing items for this date to allow re-runs
    d.prepare("DELETE FROM items WHERE digest_date = ?").run(digest.date);
    for (const item of digest.items) {
      insertItem(digest.date, item, insertStmt);
    }
  });
  tx();
}

// --- Feed CRUD ---

export interface FeedRow {
  id: number;
  name: string;
  url: string;
  is_default: number;
  enabled: number;
}

let feedsSeeded = false;

export function ensureFeeds(defaultFeeds: Array<{ name: string; url: string }>): void {
  if (feedsSeeded) return;
  if (getFeedCount() === 0) {
    seedDefaultFeeds(defaultFeeds);
  }
  feedsSeeded = true;
}

export function listFeeds(): FeedRow[] {
  const d = getDb();
  return d.prepare("SELECT id, name, url, is_default, enabled FROM feeds WHERE enabled = 1 ORDER BY name").all() as FeedRow[];
}

export function addFeed(name: string, url: string): void {
  const d = getDb();
  d.prepare("INSERT OR IGNORE INTO feeds (name, url, is_default, enabled) VALUES (?, ?, 0, 1)").run(name, url);
}

export function removeFeed(name: string): boolean {
  const d = getDb();
  const result = d.prepare("DELETE FROM feeds WHERE name = ? AND is_default = 0").run(name);
  return result.changes > 0;
}

export function seedDefaultFeeds(feeds: Array<{ name: string; url: string }>): void {
  const d = getDb();
  const insert = d.prepare("INSERT OR IGNORE INTO feeds (name, url, is_default, enabled) VALUES (?, ?, 1, 1)");
  const tx = d.transaction(() => {
    for (const feed of feeds) {
      insert.run(feed.name, feed.url);
    }
  });
  tx();
}

export function getFeedCount(): number {
  const d = getDb();
  return (d.prepare("SELECT COUNT(*) as count FROM feeds WHERE enabled = 1").get() as CountRow).count;
}

// --- Docs Snapshots ---

interface SnapshotRow {
  url: string;
  content: string;
  last_checked: string;
}

export function getDocsSnapshot(url: string): string | null {
  const d = getDb();
  const row = d.prepare("SELECT content FROM docs_snapshots WHERE url = ?").get(url) as SnapshotRow | undefined;
  return row?.content ?? null;
}

export function saveDocsSnapshot(url: string, content: string): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO docs_snapshots (url, content, last_checked)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(url) DO UPDATE SET content = excluded.content, last_checked = datetime('now')
  `).run(url, content);
}

// --- Helpers ---

function rowToDigestItem(r: ItemRow): DigestItem {
  return {
    headline: r.headline,
    tldr: r.tldr || undefined,
    summary: r.summary,
    sourceUrl: r.source_url,
    priority: r.priority,
    category: r.category as DigestCategory,
    source: r.source_name || undefined,
    imageUrl: r.image_url || undefined,
  };
}
