import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");

export interface FeedEntry {
  name: string;
  url: string;
}

export function getProjectDir(): string {
  return PROJECT_DIR;
}

export function getOutputDir(): string {
  return join(PROJECT_DIR, "output");
}
