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

export interface DigestItem {
  headline: string;
  summary: string;
  sourceUrl: string;
  priority: number;
}

export interface Digest {
  date: string;
  items: DigestItem[];
  signal: string;
}
