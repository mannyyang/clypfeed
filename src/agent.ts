import { query } from "@anthropic-ai/claude-agent-sdk";
import { gmailMcpServer } from "./tools/gmail.js";

function buildSystemPrompt(targetDate: string): string {
  return `You are an AI news aggregator agent. Your job is to process newsletter emails, RSS feeds, and official sources to produce a daily AI news digest.

Instructions:
1. Use get_published to check previously published stories — skip any story that covers the same event, even if the headline or wording is different
2. Use fetch_rss to get recent items from curated AI news RSS feeds
3. Use fetch_emails to get recent emails (adjust the hours parameter to cover the target date: ${targetDate})
4. Scan the subject lines and senders to identify AI/tech newsletters
5. Use get_email to read the content of relevant newsletters
6. Use fetch_webpage to check these official sources for recent announcements:
   - https://www.anthropic.com/news (Anthropic newsroom)
   - https://www.anthropic.com/engineering (Anthropic engineering blog)
   - https://api.github.com/repos/anthropics/claude-code/releases?per_page=3 (Claude Code releases — JSON format, check for new features, slash commands, and behavior changes)
   - https://code.claude.com/docs/en/changelog (Claude Code changelog — look for new versions, slash commands, settings, behavior changes)
   - https://x.com/AnthropicAI (official Anthropic X/Twitter account)
7. Use fetch_docs_diff (NOT fetch_webpage) to check these docs pages for NEW content:
   - https://code.claude.com/docs/llms.txt (Claude Code docs index — scan for NEW or recently added pages)
   - https://code.claude.com/docs/en/interactive-mode (Claude Code interactive features — new commands like /btw, keyboard shortcuts, UI features)
   - https://code.claude.com/docs/en/commands (Claude Code commands reference — newly added slash commands)
   - https://code.claude.com/docs/en/skills (Claude Code skills — new bundled skills)
   - https://code.claude.com/docs/en/sub-agents (Claude Code sub-agents — new agent types or capabilities)
   fetch_docs_diff compares the page against a stored snapshot and returns ONLY new/changed content. If it says "first snapshot", review ALL content for recently added features. If it reports changes, those are NEW features worth reporting.
8. Extract AI/ML news items, with this priority order:
   a. Claude model updates, releases, or capability changes (highest priority)
   b. Anthropic product news (Claude Code, Cowork, Claude.ai, MCP)
   c. Anthropic company news (funding, partnerships, policy)
   d. Direct competitive moves affecting Claude's positioning (OpenAI, Google, etc.)
   e. Ecosystem news (broader AI industry, tools, frameworks)
9. Deduplicate stories that appear in multiple newsletters, RSS feeds, or web sources
10. Rank items by priority — include all newsworthy items (no cap)
11. Assign each item a category using these definitions:
    - claude-updates: Changes to Claude models themselves — new versions, capability changes, benchmarks, safety findings, system behavior
    - anthropic-product: Anthropic product/feature updates — Claude Code releases, Claude.ai changes, API updates, MCP, pricing, new slash commands
    - anthropic-company: Corporate Anthropic news — funding, hiring, offices, leadership, policy, partnerships, legal
    - competitive: Direct competitor moves — new models from OpenAI/Google/Meta, competitive product launches
    - ecosystem: Broader AI ecosystem — acquisitions, tools, frameworks, community, research not directly about Anthropic
12. Order items by category first (claude-updates, then anthropic-product, then anthropic-company, then competitive, then ecosystem), then by priority within each category
13. Set source to the name of the newsletter, blog, or outlet where you found it (e.g. "Axios", "OpenAI Blog", "TLDR"). If the source article has a prominent image (og:image, hero image, or thumbnail), include its URL as imageUrl; otherwise omit it.
14. Use save_digest to save the result as JSON with this exact schema:
   {
     "date": "${targetDate}",
     "items": [
       {
         "headline": "Bold headline (1 line)",
         "tldr": "Single-line, 10 words or fewer — the tweet-length takeaway",
         "summary": "1-2 sentences, max 50 words. Lead with the key fact, then one sentence of context.",
         "sourceUrl": "URL to the original source",
         "priority": 1,
         "category": "claude-updates | anthropic-product | anthropic-company | competitive | ecosystem",
         "source": "Name of the outlet (e.g. Axios, TLDR, OpenAI Blog)",
         "imageUrl": "URL to article image if available, otherwise omit"
       }
     ],
     "signal": "One sentence — the single most important takeaway today"
   }

Rules:
- Only include content published within 24 hours of the target date: ${targetDate}
- Skip tutorials, opinion pieces, and "how to use" content
- Skip minor community posts unless they reveal a real product change
- If fewer than 2 genuinely newsworthy items, set signal to "Quiet day — nothing major to report."
- Summaries MUST be under 50 words. If longer, rewrite shorter.
- When parsing Claude Code releases, pay special attention to new slash commands, new tools, new settings, and behavior changes — these are the most actionable items for Claude Code users
- IMPORTANT: New features sometimes appear in docs pages WITHOUT a changelog entry (e.g. /btw was added to interactive-mode docs but never listed in the changelog). Always check the docs pages for new content, not just changelogs and release notes.
- When scanning docs pages, look for new sections, new commands, new keyboard shortcuts, or new features that were not present before — these are newsworthy even if there is no blog post or changelog entry about them
- Keep summaries concise and factual`;
}

export async function runAgent(targetDate?: string) {
  delete process.env.CLAUDECODE;
  const date = targetDate || new Date().toISOString().split("T")[0];

  // Calculate hours lookback for historical dates
  const targetMs = new Date(date + "T23:59:59").getTime();
  const hoursAgo = Math.max(0, Math.ceil((Date.now() - targetMs) / (60 * 60 * 1000)));
  const rssHours = hoursAgo + 48;
  const emailHours = hoursAgo + 24;

  console.error(`\nRunning AI news digest for ${date}...`);
  if (hoursAgo > 0) {
    console.error(`  Historical mode: looking back ${hoursAgo}h (RSS: ${rssHours}h, Email: ${emailHours}h)\n`);
  }

  const systemPrompt = buildSystemPrompt(date);

  for await (const message of query({
    prompt: `Create an AI news digest for ${date}. ${hoursAgo > 0 ? `This is a historical digest — use fetch_rss with hours=${rssHours} and fetch_emails with hours=${emailHours} to cover content from that date.` : "Fetch today's emails and create the digest."}`,
    options: {
      systemPrompt,
      mcpServers: {
        "gmail-tools": gmailMcpServer,
      },
      allowedTools: [
        "mcp__gmail-tools__fetch_emails",
        "mcp__gmail-tools__get_email",
        "mcp__gmail-tools__fetch_webpage",
        "mcp__gmail-tools__fetch_rss",
        "mcp__gmail-tools__fetch_docs_diff",
        "mcp__gmail-tools__get_published",
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
          console.error(block.text);
        } else if ("name" in block) {
          console.error(`  [tool] ${block.name}`);
        }
      }
    } else if (message.type === "result") {
      console.error(`\nAgent finished: ${(message as any).subtype}`);
    }
  }
}
