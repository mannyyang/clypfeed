import { ImapFlow } from "imapflow";
import type { EmailMeta, EmailContent } from "./types.js";

function getConfig() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const host = process.env.IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT) || 993;

  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASSWORD must be set in .env");
  }

  return { host, port, secure: true, auth: { user, pass } };
}

export async function fetchRecentEmails(hours: number = 24): Promise<EmailMeta[]> {
  const client = new ImapFlow({
    ...getConfig(),
    logger: false,
  });

  const emails: EmailMeta[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      for await (const msg of client.fetch(
        { since },
        { envelope: true, uid: true }
      )) {
        if (!msg) continue;
        const envelope = msg.envelope;
        if (!envelope) continue;
        emails.push({
          uid: String(msg.uid),
          subject: envelope.subject || "(no subject)",
          from: envelope.from?.[0]?.address || "unknown",
          date: envelope.date?.toISOString() || new Date().toISOString(),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}

export async function getEmailBody(uid: string): Promise<EmailContent> {
  const client = new ImapFlow({
    ...getConfig(),
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const result = await client.fetchOne(uid, {
        envelope: true,
        source: true,
        uid: true,
      });

      if (!result) {
        throw new Error(`Email with UID ${uid} not found`);
      }

      const envelope = result.envelope;
      const source = result.source?.toString() || "";
      const { html, text } = extractParts(source);

      // Mark email as read
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });

      return {
        uid: String(result.uid),
        subject: envelope?.subject || "(no subject)",
        from: envelope?.from?.[0]?.address || "unknown",
        date: envelope?.date?.toISOString() || new Date().toISOString(),
        html,
        text,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

function extractParts(source: string): { html: string; text: string } {
  // Simple MIME parser — extract text/html and text/plain parts
  let html = "";
  let text = "";

  // Try to find HTML content
  const htmlMatch = source.match(
    /Content-Type:\s*text\/html[^]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\.\r?\n|$)/i
  );
  if (htmlMatch) {
    html = decodeContent(htmlMatch[1], source);
  }

  // Try to find plain text content
  const textMatch = source.match(
    /Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\.\r?\n|$)/i
  );
  if (textMatch) {
    text = decodeContent(textMatch[1], source);
  }

  // Fallback: if no MIME parts found, treat entire source as text
  if (!html && !text) {
    text = source;
  }

  return { html, text };
}

function decodeContent(content: string, fullSource: string): string {
  // Check for base64 encoding
  if (/Content-Transfer-Encoding:\s*base64/i.test(fullSource)) {
    try {
      return Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf-8");
    } catch {
      return content;
    }
  }

  // Check for quoted-printable
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(fullSource)) {
    return content
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
  }

  return content;
}
