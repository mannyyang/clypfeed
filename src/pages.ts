import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Digest, DigestItem, DigestCategory } from "./types.js";
import { CATEGORY_ORDER, CATEGORY_LABELS, groupByCategory } from "./types.js";
import { getProjectDir } from "./config.js";
import { listDigestDates, getFullDigest } from "./db.js";

const docsDir = join(getProjectDir(), "docs");

const CATEGORY_COLORS: Record<DigestCategory, { bg: string; text: string; glow: string }> = {
  "claude-updates": { bg: "rgba(255,160,50,0.12)", text: "#ffb347", glow: "rgba(255,160,50,0.08)" },
  "anthropic-product": { bg: "rgba(100,180,255,0.12)", text: "#6cb4ff", glow: "rgba(100,180,255,0.08)" },
  "anthropic-company": { bg: "rgba(190,130,255,0.12)", text: "#be82ff", glow: "rgba(190,130,255,0.08)" },
  competitive: { bg: "rgba(255,100,100,0.12)", text: "#ff6b6b", glow: "rgba(255,100,100,0.08)" },
  ecosystem: { bg: "rgba(80,220,140,0.12)", text: "#50dc8c", glow: "rgba(80,220,140,0.08)" },
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

function renderItem(item: DigestItem, category: DigestCategory, featured: boolean): string {
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

  const cardClass = featured ? "card card--featured" : "card";

  return `
            <article class="${cardClass}" style="--cat-glow: ${colors.glow};">
              ${image}
              <div class="card-body">
                <span class="category-tag" style="background: ${colors.bg}; color: ${colors.text};">${CATEGORY_LABELS[category]}</span>
                <h3><a href="${item.sourceUrl}">${item.headline}</a></h3>
                ${tldr}
                <p class="summary">${item.summary}</p>
                ${source ? `<div class="item-meta">${source}</div>` : ""}
              </div>
            </article>`;
}

function buildHtml(title: string, digests: Digest[]): string {
  const sorted = [...digests].sort((a, b) => b.date.localeCompare(a.date));

  const sections = sorted
    .map((digest) => {
      const grouped = groupByCategory(digest.items);
      const allCards: string[] = [];
      let isFirst = true;

      for (const cat of CATEGORY_ORDER) {
        const catItems = grouped.get(cat);
        if (catItems && catItems.length > 0) {
          for (const item of catItems) {
            allCards.push(renderItem(item, cat as DigestCategory, isFirst));
            isFirst = false;
          }
        }
      }

      const storyCount = digest.items.length;

      return `
    <section class="digest">
      <div class="day-header">
        <h2>${formatDate(digest.date)}</h2>
        <span class="story-count">${storyCount} ${storyCount === 1 ? "story" : "stories"}</span>
      </div>
      <div class="signal">${digest.signal}</div>
      <div class="bento-grid">
        ${allCards.join("\n") || '<p class="empty">No items today.</p>'}
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0f;
      color: #e8e8ed;
      min-height: 100vh;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    .page {
      max-width: 1080px;
      margin: 0 auto;
      padding: 3rem 2rem 4rem;
    }

    /* --- Header --- */
    header {
      margin-bottom: 3.5rem;
      position: relative;
    }
    header::after {
      content: '';
      position: absolute;
      bottom: -1.5rem;
      left: 0;
      width: 48px;
      height: 3px;
      background: linear-gradient(90deg, #6cb4ff, #be82ff);
      border-radius: 2px;
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 900;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #fff 0%, #a0a0b0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tagline {
      color: #555;
      font-size: 0.9rem;
      font-weight: 500;
      margin-top: 0.35rem;
      letter-spacing: 0.01em;
    }

    /* --- Day section --- */
    .digest {
      margin-bottom: 4rem;
    }
    .day-header {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .digest h2 {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #fff;
    }
    .story-count {
      font-size: 0.75rem;
      font-weight: 500;
      color: #555;
      padding: 2px 10px;
      background: rgba(255,255,255,0.04);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.06);
    }

    /* --- Signal card --- */
    .signal {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      line-height: 1.6;
      color: #b0b0bc;
    }

    /* --- Bento grid --- */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.875rem;
    }

    /* --- Card --- */
    .card {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 1.35rem;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 16px;
      background: radial-gradient(ellipse at top left, var(--cat-glow, transparent), transparent 70%);
      pointer-events: none;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(255,255,255,0.12);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }

    /* Featured card spans 2 columns */
    .card--featured {
      grid-column: span 2;
    }
    .card--featured h3 {
      font-size: 1.15rem;
    }

    .card .item-image {
      width: 100%;
      height: 140px;
      object-fit: cover;
      border-radius: 10px;
      margin-bottom: 1rem;
      background: rgba(255,255,255,0.04);
    }

    .card-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      position: relative;
      z-index: 1;
    }

    /* --- Category tag --- */
    .category-tag {
      display: inline-block;
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 10px;
      border-radius: 8px;
      margin-bottom: 0.65rem;
      align-self: flex-start;
    }

    /* --- Typography --- */
    .card h3 {
      font-size: 0.95rem;
      font-weight: 700;
      margin-bottom: 0.4rem;
      line-height: 1.35;
      letter-spacing: -0.01em;
    }
    .card h3 a {
      color: #f0f0f5;
      text-decoration: none;
      transition: color 0.15s ease;
    }
    .card h3 a:hover { color: #fff; }

    .card .tldr {
      color: #8888a0;
      font-size: 0.78rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      line-height: 1.45;
      font-style: italic;
    }

    .card .summary {
      color: #6a6a7a;
      font-size: 0.8rem;
      line-height: 1.55;
      flex: 1;
    }

    .item-meta {
      margin-top: auto;
      padding-top: 0.65rem;
    }

    .source {
      font-size: 0.68rem;
      font-weight: 500;
      color: #444;
      letter-spacing: 0.01em;
    }

    .empty { color: #444; font-style: italic; }

    /* --- Responsive --- */
    @media (max-width: 820px) {
      .bento-grid { grid-template-columns: repeat(2, 1fr); }
      .card--featured { grid-column: span 2; }
    }
    @media (max-width: 560px) {
      .page { padding: 2rem 1rem 3rem; }
      h1 { font-size: 1.75rem; }
      .bento-grid { grid-template-columns: 1fr; }
      .card--featured { grid-column: span 1; }
      .card .item-image { height: 110px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <h1>ClypFeed</h1>
      <p class="tagline">Daily AI news, curated by Claude</p>
    </header>
    ${sections}
  </div>
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
