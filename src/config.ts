import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");

export interface FeedEntry {
  name: string;
  url: string;
}

export interface ClypFeedConfig {
  feeds: FeedEntry[];
}

const configPath = join(PROJECT_DIR, "output", "config.json");

export function getProjectDir(): string {
  return PROJECT_DIR;
}

export function getOutputDir(): string {
  return join(PROJECT_DIR, "output");
}

export async function loadConfig(): Promise<ClypFeedConfig> {
  try {
    const data = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(data);
    return {
      feeds: Array.isArray(parsed.feeds) ? parsed.feeds : [],
    };
  } catch {
    return { feeds: [] };
  }
}

export async function saveConfig(config: ClypFeedConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}
