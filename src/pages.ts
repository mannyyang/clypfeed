import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Digest } from "./types.js";

const outputDir = join(process.cwd(), "output");
const docsDir = join(process.cwd(), "docs");

function buildHtml(digests: Digest[]): string {
  const sorted = digests.sort((a, b) => b.date.localeCompare(a.date));

  const sections = sorted
    .map((digest) => {
      const items = digest.items
        .map(
          (item) => `
        <article class="item">
          <h3><a href="${item.sourceUrl}">${item.headline}</a></h3>
          <p>${item.summary}</p>
        </article>`
        )
        .join("\n");

      return `
    <section class="digest">
      <h2>${digest.date}</h2>
      <div class="signal">${digest.signal}</div>
      ${items || '<p class="empty">No items today.</p>'}
    </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClypFeed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; max-width: 640px; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
    .tagline { color: #888; font-size: 0.9rem; margin-bottom: 2rem; }
    .digest { margin-bottom: 2.5rem; }
    .digest h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; color: #ccc; }
    .signal { background: #1a1a2e; border-left: 3px solid #6c63ff; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.9rem; line-height: 1.5; }
    .item { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #1a1a1a; }
    .item:last-child { border-bottom: none; }
    .item h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.35rem; }
    .item h3 a { color: #8b8bf5; text-decoration: none; }
    .item h3 a:hover { text-decoration: underline; }
    .item p { color: #aaa; line-height: 1.6; font-size: 0.85rem; }
    .empty { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>ClypFeed</h1>
  <p class="tagline">AI news digests</p>
  ${sections}
</body>
</html>`;
}

export async function buildPages(): Promise<void> {
  await mkdir(docsDir, { recursive: true });

  const files = (await readdir(outputDir)).filter(
    (f) => f.endsWith(".json") && f !== "published.json"
  );

  const digests: Digest[] = [];
  for (const file of files) {
    const raw = await readFile(join(outputDir, file), "utf-8");
    digests.push(JSON.parse(raw));
  }

  await writeFile(join(docsDir, "index.html"), buildHtml(digests));
  console.log(`Built page with ${digests.length} digest(s) in docs/`);
}
