import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { fetchRecentEmails, getEmailBody } from "../imap.js";
import { parseEmailHtml } from "../parser.js";
import { saveDigestTool, getPublishedTool } from "./storage.js";
import { fetchWebpageTool } from "./web.js";

const fetchEmailsTool = tool(
  "fetch_emails",
  "Fetch recent emails from Gmail inbox. Returns a JSON array of email metadata (uid, subject, from, date). Use get_email with a uid to read the full content.",
  { hours: z.number().default(24).describe("How many hours back to search") },
  async ({ hours }) => {
    const emails = await fetchRecentEmails(hours);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(emails, null, 2),
        },
      ],
    };
  },
  { annotations: { readOnly: true, openWorld: true } }
);

const getEmailTool = tool(
  "get_email",
  "Get the full body of a specific email by its UID. Returns the parsed text content of the email, with links preserved as markdown.",
  { uid: z.string().describe("Email UID from fetch_emails results") },
  async ({ uid }) => {
    const email = await getEmailBody(uid);
    const parsedContent = email.html
      ? parseEmailHtml(email.html)
      : email.text;

    return {
      content: [
        {
          type: "text" as const,
          text: `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\n${parsedContent}`,
        },
      ],
    };
  },
  { annotations: { readOnly: true } }
);

export const gmailMcpServer = createSdkMcpServer({
  name: "gmail-tools",
  tools: [fetchEmailsTool, getEmailTool, fetchWebpageTool, getPublishedTool, saveDigestTool],
});
