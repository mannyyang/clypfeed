import * as cheerio from "cheerio";

export function parseEmailHtml(html: string): string {
  if (!html) return "";

  const $ = cheerio.load(html);

  // Remove noise elements
  $("style, script, noscript, iframe, img, svg").remove();
  $("header, footer, nav").remove();
  $('[class*="unsubscribe"], [class*="footer"], [class*="social"]').remove();
  $('a[href*="unsubscribe"]').closest("tr, div, p").remove();

  // Convert links to markdown format
  $("a").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    const text = $el.text().trim();
    if (href && text && !href.startsWith("mailto:")) {
      $el.replaceWith(`[${text}](${href})`);
    }
  });

  // Get text content
  let text = $("body").text();

  // Clean up whitespace
  text = text
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // Truncate if too long (keep first 5000 chars to stay within token limits)
  if (text.length > 5000) {
    text = text.slice(0, 5000) + "\n\n[... truncated]";
  }

  return text;
}
