export interface EmailMeta {
  uid: string;
  subject: string;
  from: string;
  date: string;
}

export interface EmailContent {
  uid: string;
  subject: string;
  from: string;
  date: string;
  html: string;
  text: string;
}

export type DigestCategory =
  | "claude-updates"
  | "anthropic-product"
  | "anthropic-company"
  | "competitive"
  | "ecosystem";

export interface DigestItem {
  headline: string;
  tldr?: string;
  summary: string;
  sourceUrl: string;
  priority: number;
  category?: DigestCategory;
  source?: string;
  imageUrl?: string;
}

export interface Digest {
  date: string;
  items: DigestItem[];
  signal: string;
}

export const DEFAULT_CATEGORY: DigestCategory = "ecosystem";

export const CATEGORY_ORDER: DigestCategory[] = [
  "claude-updates",
  "anthropic-product",
  "anthropic-company",
  "competitive",
  "ecosystem",
];

export const CATEGORY_LABELS: Record<DigestCategory, string> = {
  "claude-updates": "Claude Updates",
  "anthropic-product": "Anthropic Product",
  "anthropic-company": "Anthropic Company",
  competitive: "Competitive",
  ecosystem: "Ecosystem",
};

export function groupByCategory(items: DigestItem[]): Map<string, DigestItem[]> {
  const grouped = new Map<string, DigestItem[]>();
  for (const item of items) {
    const cat = item.category || DEFAULT_CATEGORY;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }
  return grouped;
}
