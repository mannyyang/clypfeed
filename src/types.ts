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
