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

function renderItem(item: DigestItem, category: DigestCategory): string {
  const colors = CATEGORY_COLORS[category];
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
            <article class="card" style="border-top: 3px solid ${colors.border};">
              ${image}
              <div class="card-body">
                <span class="category-tag" style="background: ${colors.bg}; color: ${colors.text};">${CATEGORY_LABELS[category]}</span>
                <h4><a href="${item.sourceUrl}">${item.headline}</a></h4>
                ${tldr}
                <p>${item.summary}</p>
                ${source ? `<div class="item-meta">${source}</div>` : ""}
              </div>
            </article>`;
}

function renderCategoryCards(category: DigestCategory, items: DigestItem[]): string {
  return items.map((item) => renderItem(item, category)).join("\n");
}

function buildHtml(title: string, digests: Digest[]): string {
  const sorted = [...digests].sort((a, b) => b.date.localeCompare(a.date));

  const sections = sorted
    .map((digest) => {
      const grouped = groupByCategory(digest.items);
      const cards: string[] = [];

      for (const cat of CATEGORY_ORDER) {
        const catItems = grouped.get(cat);
        if (catItems && catItems.length > 0) {
          cards.push(renderCategoryCards(cat as DigestCategory, catItems));
        }
      }

      return `
    <section class="digest">
      <h2>${formatDate(digest.date)}</h2>
      <div class="signal">${digest.signal}</div>
      <div class="bento-grid">
        ${cards.join("\n") || '<p class="empty">No items today.</p>'}
      </div>
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
      background: #f5f5f7;
      color: #111;
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      line-height: 1.6;
    }

    header {
      margin-bottom: 2.5rem;
      padding-bottom: 1rem;
    }
    h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; }
    .tagline { color: #888; font-size: 0.85rem; margin-top: 0.25rem; }

    .digest { margin-bottom: 3rem; }
    .digest h2 {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      margin-bottom: 0.75rem;
    }

    .signal {
      background: #fff;
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.25rem;
      font-size: 0.9rem;
      line-height: 1.5;
      color: #333;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .bento-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .card {
      background: #fff;
      border-radius: 14px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      transition: box-shadow 0.15s ease;
    }
    .card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .card .item-image {
      width: 100%;
      height: 120px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 0.75rem;
      background: #f0f0f0;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .category-tag {
      display: inline-block;
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 0.5rem;
      align-self: flex-start;
    }

    .card h4 {
      font-size: 0.9rem;
      font-weight: 650;
      margin-bottom: 0.35rem;
      line-height: 1.35;
    }
    .card h4 a { color: #111; text-decoration: none; }
    .card h4 a:hover { text-decoration: underline; }

    .card .tldr {
      color: #333;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 0.25rem;
      line-height: 1.4;
    }

    .card p {
      color: #666;
      font-size: 0.8rem;
      line-height: 1.5;
      flex: 1;
    }

    .item-meta {
      margin-top: auto;
      padding-top: 0.5rem;
    }

    .source {
      font-size: 0.7rem;
      color: #aaa;
    }

    .empty { color: #999; font-style: italic; }

    @media (max-width: 600px) {
      .bento-grid {
        grid-template-columns: 1fr;
      }
      .card .item-image { height: 100px; }
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
