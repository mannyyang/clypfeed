# ClypFeed

**Live site: https://mannyyang.github.io/clypfeed/**

AI news digest CLI that ingests Gmail newsletters and RSS feeds, extracts AI/ML news, and produces daily digests using the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview).

## Install

```bash
curl -sSL https://raw.githubusercontent.com/mannyyang/clypfeed/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/mannyyang/clypfeed.git
cd clypfeed
npm install
```

### Prerequisites

- Node.js 22+
- Claude Code (uses your subscription — no API key needed)

### Optional: Email ingestion

To pull newsletters from Gmail, create a `.env` file:

```
EMAIL_USER=you@gmail.com
EMAIL_PASSWORD=your-app-password
```

To get an app password:
1. Enable [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification)
2. Go to [App passwords](https://myaccount.google.com/apppasswords) and generate one
3. Enable IMAP: Gmail → Settings → Forwarding and POP/IMAP → Enable IMAP

## Usage

```
clypfeed <command> [args] [flags]

Commands:
  run                               Generate a new digest now
  list [--limit N]                  List available digests (default: 20)
  get <date>                        Get digest for a specific date (YYYY-MM-DD)
  search <query> [--days N]         Search digests by keyword (default: 7 days)
  pages                             Build HTML pages from digests

  feed list                         List configured RSS feeds
  feed add <name> <url>             Add an RSS feed
  feed remove <name>                Remove an RSS feed by name
```

### Examples

```bash
clypfeed run                                  # generate today's digest
clypfeed list                                 # see available digests
clypfeed get 2026-03-10                       # read a specific digest
clypfeed search "Claude" --days 14            # search recent digests
clypfeed feed add "TechCrunch" "https://techcrunch.com/feed"
```

Output is saved to `output/YYYY-MM-DD.json`. HTML pages are built to `docs/`.

## How it works

1. Fetches RSS feeds from 15 curated AI/tech sources
2. Connects to Gmail via IMAP and fetches recent newsletters (if configured)
3. Scrapes official sources (Anthropic newsroom, Claude Code releases)
4. Claude Agent autonomously reads, prioritizes, and deduplicates stories
5. Saves a structured JSON digest and builds HTML pages

## Architecture

```
CLI (src/cli.ts)
└── Claude Agent SDK (query)
    └── In-process MCP Server ("gmail-tools")
        ├── fetch_emails   — list recent emails via IMAP
        ├── get_email      — read & parse a single email
        ├── fetch_rss      — pull items from RSS feeds
        ├── fetch_webpage  — scrape web sources
        ├── get_published  — check previously published stories
        └── save_digest    — write JSON digest to disk
```

## License

ISC
