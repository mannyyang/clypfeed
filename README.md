# ClypFeed

AI-powered news aggregator that ingests newsletters from Gmail, extracts AI/ML news, and produces daily digests using the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview).

## How it works

1. Connects to Gmail via IMAP and fetches recent emails
2. Claude Agent autonomously reads newsletters and extracts AI news
3. Prioritizes and deduplicates stories across sources
4. Saves a structured JSON digest to `output/`

## Setup

### Prerequisites

- Node.js 22+
- [Anthropic API key](https://platform.claude.com/)
- Gmail account with IMAP enabled

### Gmail App Password

1. Enable [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) on your Google Account
2. Go to [App passwords](https://myaccount.google.com/apppasswords)
3. Select "Mail" and generate a 16-character password
4. Enable IMAP: Gmail → Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP

### Install

```bash
git clone https://github.com/mannyyang/clypfeed.git
cd clypfeed
npm install
cp .env.example .env
# Edit .env with your credentials
```

## Usage

```bash
# Run once
npm start

# Run on a daily schedule (default: 8am)
npm run schedule

# Custom cron schedule (weekdays at 9am)
npx tsx src/index.ts --schedule "0 9 * * 1-5"
```

Output is saved to `output/YYYY-MM-DD.json`.

## Architecture

```
Claude Agent SDK (query)
├── In-process MCP Server ("gmail-tools")
│   ├── fetch_emails  — list recent emails via IMAP
│   ├── get_email     — read & parse a single email
│   └── save_digest   — write JSON digest to disk
└── System prompt with priority rules
```

## License

ISC
