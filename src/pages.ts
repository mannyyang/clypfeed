import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Digest, DigestItem, DigestCategory } from "./types.js";
import { CATEGORY_ORDER, CATEGORY_LABELS, groupByCategory } from "./types.js";
import { getProjectDir } from "./config.js";
import { listDigestDates, getFullDigest } from "./db.js";

const docsDir = join(getProjectDir(), "docs");

const CATEGORY_COLORS: Record<DigestCategory, { bg: string; text: string; border: string }> = {
  "claude-updates": { bg: "#fff3e0", text: "#e65100", border: "#f57c00" },
  "anthropic-product": { bg: "#e3f2fd", text: "#1565c0", border: "#1976d2" },
  "anthropic-company": { bg: "#f3e5f5", text: "#7b1fa2", border: "#8e24aa" },
  competitive: { bg: "#fce4ec", text: "#c62828", border: "#d32f2f" },
  ecosystem: { bg: "#e8f5e9", text: "#2e7d32", border: "#388e3c" },
};

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
  const source = item.source
    ? `<span class="source">via ${item.source}</span>`
    : "";
  const tldr = item.tldr
    ? `<p class="tldr">${item.tldr}</p>`
    : "";

  return `
          <article class="item">
            ${image}
            <div class="item-content">
              ${source ? `<div class="item-meta">${source}</div>` : ""}
              <h4><a href="${item.sourceUrl}">${item.headline}</a></h4>
              ${tldr}
              <p>${item.summary}</p>
            </div>
          </article>`;
}

function renderCategorySection(category: DigestCategory, items: DigestItem[]): string {
  const colors = CATEGORY_COLORS[category];
  const label = CATEGORY_LABELS[category];
  const renderedItems = items.map(renderItem).join("\n");

  return `
        <div class="category-section" style="border-left: 3px solid ${colors.border}; padding-left: 1rem; margin-bottom: 1.5rem;">
          <h3 class="category-header" style="color: ${colors.text};">
            <span class="category-tag" style="background: ${colors.bg}; color: ${colors.text};">${label}</span>
          </h3>
          ${renderedItems}
        </div>`;
}

function buildHtml(title: string, digests: Digest[]): string {
  const sorted = [...digests].sort((a, b) => b.date.localeCompare(a.date));

  const sections = sorted
    .map((digest) => {
      const grouped = groupByCategory(digest.items);
      const categorySections: string[] = [];

      for (const cat of CATEGORY_ORDER) {
        const catItems = grouped.get(cat);
        if (catItems && catItems.length > 0) {
          categorySections.push(renderCategorySection(cat, catItems));
        }
      }

      return `
    <section class="digest">
      <h2>${formatDate(digest.date)}</h2>
      <div class="signal">${digest.signal}</div>
      ${categorySections.join("\n") || '<p class="empty">No items today.</p>'}
    </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fff;
      color: #111;
      max-width: 700px;
      margin: 0 auto;
      padding: 2rem 1rem;
      line-height: 1.6;
    }

    header { margin-bottom: 2rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 1rem; }
    h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .tagline { color: #888; font-size: 0.85rem; margin-top: 0.15rem; }

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

    .category-header {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.75rem;
    }

    .category-tag {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 8px;
      border-radius: 3px;
    }

    .item {
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f0f0f0;
      overflow: hidden;
    }
    .item:last-child { border-bottom: none; padding-bottom: 0; }

    .item-image {
      float: right;
      width: 100px;
      height: 66px;
      object-fit: cover;
      border-radius: 4px;
      margin-left: 0.75rem;
      margin-bottom: 0.5rem;
      background: #f0f0f0;
    }

    .item-content { overflow: hidden; }

    .item-meta {
      margin-bottom: 0.2rem;
    }

    .source {
      font-size: 0.7rem;
      color: #999;
    }

    .item h4 { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.2rem; line-height: 1.3; }
    .item h4 a { color: #111; text-decoration: none; }
    .item h4 a:hover { text-decoration: underline; }

    .item .tldr {
      color: #333;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 0.15rem;
      line-height: 1.4;
    }

    .item p { color: #666; font-size: 0.8rem; line-height: 1.5; }

    .empty { color: #999; font-style: italic; }

    @media (max-width: 480px) {
      .item-image { width: 72px; height: 48px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>ClypFeed</h1>
    <p class="tagline">AI news digests</p>
  </header>
  ${sections}
</body>
</html>`;
}

export async function buildPages(): Promise<void> {
  await mkdir(docsDir, { recursive: true });

  const dates = listDigestDates(7);
  const recentDigests: Digest[] = [];

  for (const date of dates) {
    const digest = getFullDigest(date);
    if (digest) recentDigests.push(digest);
  }

  await writeFile(
    join(docsDir, "index.html"),
    buildHtml("ClypFeed", recentDigests)
  );

  console.error(`Built index.html with ${recentDigests.length} digests`);
}
