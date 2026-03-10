import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Digest, DigestItem } from "./types.js";

const outputDir = join(process.cwd(), "output");
const docsDir = join(process.cwd(), "docs");

const CATEGORY_LABELS: Record<string, string> = {
  "claude-updates": "Claude Updates",
  "anthropic-product": "Anthropic Product",
  "anthropic-company": "Anthropic Company",
  competitive: "Competitive",
  ecosystem: "Ecosystem",
};

interface PageConfig {
  title: string;
  subtitle?: string;
  digests: Digest[];
  navLinks?: { label: string; href: string }[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderItem(item: DigestItem): string {
  const image = item.imageUrl
    ? `<img class="item-image" src="${item.imageUrl}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    : "";
  const category = item.category
    ? `<span class="category-tag">${CATEGORY_LABELS[item.category] || "Ecosystem"}</span>`
    : "";
  const source = item.source
    ? `<span class="source">via ${item.source}</span>`
    : "";

  return `
        <article class="item">
          ${image}
          <div class="item-content">
            <div class="item-meta">${category}${source}</div>
            <h3><a href="${item.sourceUrl}">${item.headline}</a></h3>
            <p>${item.summary}</p>
          </div>
        </article>`;
}

function buildHtml(config: PageConfig): string {
  const sorted = [...config.digests].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const nav = (config.navLinks || [])
    .map((link) => `<a href="${link.href}" class="nav-link">${link.label}</a>`)
    .join(" ");

  const sections = sorted
    .map((digest) => {
      const items = digest.items.map(renderItem).join("\n");

      return `
    <section class="digest">
      <h2>${formatDate(digest.date)}</h2>
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
  <title>${config.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fff;
      color: #111;
      max-width: 640px;
      margin: 0 auto;
      padding: 2rem 1rem;
      line-height: 1.6;
    }

    header { margin-bottom: 2rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 1rem; }
    h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .tagline { color: #888; font-size: 0.85rem; margin-top: 0.15rem; }

    nav { margin-top: 0.75rem; }
    .nav-link {
      font-size: 0.8rem;
      color: #111;
      text-decoration: none;
      border: 1px solid #ddd;
      padding: 0.25rem 0.75rem;
      border-radius: 3px;
    }
    .nav-link:hover { background: #f5f5f5; }

    .digest { margin-bottom: 2.5rem; }
    .digest h2 {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      margin-bottom: 0.75rem;
    }

    .signal {
      background: #f8f8f8;
      border-left: 3px solid #111;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      font-size: 0.9rem;
      line-height: 1.5;
      color: #333;
    }

    .item {
      margin-bottom: 1.25rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid #eee;
      overflow: hidden;
    }
    .item:last-child { border-bottom: none; }

    .item-image {
      float: right;
      width: 120px;
      height: 80px;
      object-fit: cover;
      border-radius: 4px;
      margin-left: 1rem;
      margin-bottom: 0.5rem;
      background: #f0f0f0;
    }

    .item-content { overflow: hidden; }

    .item-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }

    .category-tag {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #f0f0f0;
      color: #555;
      padding: 2px 6px;
      border-radius: 2px;
    }

    .source {
      font-size: 0.7rem;
      color: #999;
    }

    .item h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.3rem; line-height: 1.3; }
    .item h3 a { color: #111; text-decoration: none; }
    .item h3 a:hover { text-decoration: underline; }

    .item p { color: #555; font-size: 0.85rem; line-height: 1.6; }

    .empty { color: #999; font-style: italic; }

    @media (max-width: 480px) {
      .item-image { width: 80px; height: 56px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>ClypFeed</h1>
    <p class="tagline">${config.subtitle || "AI news digests"}</p>
    ${nav ? `<nav>${nav}</nav>` : ""}
  </header>
  ${sections}
</body>
</html>`;
}

export async function buildPages(): Promise<void> {
  await mkdir(docsDir, { recursive: true });

  const files = (await readdir(outputDir)).filter(
    (f: string) => f.endsWith(".json") && f !== "published.json"
  );

  const digests: Digest[] = [];
  for (const file of files) {
    const raw = await readFile(join(outputDir, file), "utf-8");
    digests.push(JSON.parse(raw));
  }

  const sorted = [...digests].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted.slice(0, 1);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const recentDigests = sorted.filter((d) => d.date >= cutoffStr);

  await writeFile(
    join(docsDir, "index.html"),
    buildHtml({
      title: "ClypFeed",
      digests: latest,
      navLinks: [{ label: "Past 7 days \u2192", href: "archive.html" }],
    })
  );

  await writeFile(
    join(docsDir, "archive.html"),
    buildHtml({
      title: "ClypFeed \u2014 Past 7 Days",
      subtitle: "Past 7 days",
      digests: recentDigests,
      navLinks: [{ label: "\u2190 Today", href: "index.html" }],
    })
  );

  console.log(
    `Built pages: ${latest.length} digest on index, ${recentDigests.length} on archive`
  );
}
