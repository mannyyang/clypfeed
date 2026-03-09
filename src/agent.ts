import { query } from "@anthropic-ai/claude-agent-sdk";
import { gmailMcpServer } from "./tools/gmail.js";

export async function runAgent() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`\nRunning AI news digest for ${today}...\n`);

  for await (const message of query({
    prompt: `Fetch today's emails and create an AI news digest for ${today}.`,
    options: {
      systemPrompt: `You are an AI news aggregator agent. Your job is to process newsletter emails and produce a daily AI news digest.

Instructions:
1. Use fetch_emails to get emails from the last 24 hours
2. Scan the subject lines and senders to identify AI/tech newsletters
3. Use get_email to read the content of relevant newsletters
4. Use fetch_webpage to check these official sources for recent announcements:
   - https://www.anthropic.com/news (Anthropic newsroom)
   - https://www.anthropic.com/engineering (Anthropic engineering blog)
5. Extract AI/ML news items, with this priority order:
   a. Claude model updates, releases, or capability changes (highest priority)
   b. Anthropic product news (Claude Code, Cowork, Claude.ai, MCP)
   c. Anthropic company news (funding, partnerships, policy)
   d. Direct competitive moves affecting Claude's positioning (OpenAI, Google, etc.)
6. Deduplicate stories that appear in multiple newsletters or web sources
7. Rank items by priority, keep top 3-5 items max
8. Use save_digest to save the result as JSON with this exact schema:
   {
     "date": "${today}",
     "items": [
       {
         "headline": "Bold headline (1 line)",
         "summary": "2-3 sentences on what happened and why it matters",
         "sourceUrl": "URL to the original source",
         "priority": 1
       }
     ],
     "signal": "One sentence — the single most important takeaway today"
   }

Rules:
- Skip anything older than 24 hours
- Skip tutorials, opinion pieces, and "how to use" content
- Skip minor community posts unless they reveal a real product change
- If fewer than 2 genuinely newsworthy items, set signal to "Quiet day — nothing major to report."
- Keep summaries concise and factual`,
      mcpServers: {
        "gmail-tools": gmailMcpServer,
      },
      allowedTools: [
        "mcp__gmail-tools__fetch_emails",
        "mcp__gmail-tools__get_email",
        "mcp__gmail-tools__fetch_webpage",
        "mcp__gmail-tools__save_digest",
      ],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      model: "claude-sonnet-4-6",
      maxTurns: 30,
    },
  })) {
    if (message.type === "assistant") {
      for (const block of (message as any).message?.content ?? []) {
        if ("text" in block) {
          console.log(block.text);
        } else if ("name" in block) {
          console.log(`  [tool] ${block.name}`);
        }
      }
    } else if (message.type === "result") {
      console.log(`\nAgent finished: ${(message as any).subtype}`);
    }
  }
}
