# Ozone Report to Auto-Label

Automatically applies labels to Bluesky posts and accounts based on reports from whitelisted moderators.

## How it works

1. Monitors Ozone for new reports
2. Checks if reporter is in whitelist
3. Parses report comment for label commands
4. Automatically applies labels

## Features

### Comment Commands
**Add Labels:**
- `add label1` - Apply label1 to reported item
- `add label1,label2` - Apply multiple labels
- `add-account label1` - Force apply to account (even when reporting post)
- `add-post label1` - Force apply to post (even when reporting account)
- `add-a` / `add-p` - Shortcuts for above

**Remove Labels:**
- `remove label1` - Remove label1 from reported item
- `remove label1,label2` - Remove multiple labels
- `remove-account label1` - Force remove from account
- `remove-post label1` - Force remove from post
- `remove-a` / `remove-p` - Shortcuts for above

### Report Type Auto-Labels
Automatically apply labels based on the report type selected (spam, misleading, etc.).
Configure in environment variables - works without needing to write comments.

## Setup

### Using Docker (Recommended)

1. Create a `.env` file with your configuration:

```env
# Bluesky labeler credentials
BSKY_LABELER_USERNAME="your-labeler-handle"
BSKY_LABELER_PASSWORD="your-app-password"
BSKY_LABELER_DID="did:plc:your-labeler-did"

# Bluesky DM credentials (app password with chat scope)
BSKY_DM_USERNAME="your-labeler-handle"
BSKY_DM_PASSWORD="your-chat-enabled-app-password"

# Ozone server URL
OZONE_URL="https://ozone.example.com"

# Polling interval in seconds
POLLING_SECONDS=30

# Comma-separated list of whitelisted moderator DIDs
WHITELISTED_MODERATORS="did:plc:moderator1,did:plc:moderator2"

# Auto-labels for report types (comma-separated labels, leave empty to disable)
REPORT_TYPE_MISLEADING="misleading"
REPORT_TYPE_SPAM="spam,promotional-content"
REPORT_TYPE_SEXUAL="sexual-content"
REPORT_TYPE_RUDE="harassment"
REPORT_TYPE_VIOLATION="illegal-content"
REPORT_TYPE_OTHER=""

# Moderator notification preferences (format: did:method, comma-separated)
# Methods: dm (Bluesky DM)
MODERATOR_NOTIFICATIONS="did:plc:moderator1:dm,did:plc:moderator2:dm"

# Valid labels that can be applied (comma-separated)
VALID_LABELS="clutter,garbage,spam,promotional-content,misleading,sexual-content,harassment,illegal-content"
```

2. Create a `docker-compose.yml` file:

```yaml
services:
  ozone-report-to-autolabel:
    image: ghcr.io/femavibes/ozone-report-to-autolabel:latest
    env_file:
      - .env
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
```

3. Run the service:

```bash
docker compose up -d
```

### Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Install dependencies: `bun install`
4. Run: `bun run src/index.ts`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|----------|
| `BSKY_LABELER_USERNAME` | Your labeler's handle | `labeler.example.com` |
| `BSKY_LABELER_PASSWORD` | App password for labeler | `abcd-efgh-ijkl-mnop` |
| `BSKY_LABELER_DID` | DID of your labeler | `did:plc:abc123...` |
| `BSKY_DM_USERNAME` | Username for DM notifications | `labeler.example.com` |
| `BSKY_DM_PASSWORD` | App password with chat scope | `abcd-efgh-ijkl-mnop` |
| `OZONE_URL` | URL to your Ozone server | `https://ozone.example.com` |
| `POLLING_SECONDS` | How often to check for reports | `30` |
| `WHITELISTED_MODERATORS` | Comma-separated DIDs of trusted moderators | `did:plc:mod1,did:plc:mod2` |
| `MODERATOR_NOTIFICATIONS` | DM notification preferences | `did:plc:mod1:dm` |
| `VALID_LABELS` | Comma-separated list of allowed labels | `spam,harassment,clutter` |
| `REPORT_TYPE_MISLEADING` | Auto-labels for misleading reports | `misleading,misinformation` |
| `REPORT_TYPE_SPAM` | Auto-labels for spam reports | `spam,promotional-content` |
| `REPORT_TYPE_SEXUAL` | Auto-labels for sexual content reports | `sexual-content` |
| `REPORT_TYPE_RUDE` | Auto-labels for rude/harassment reports | `harassment,abuse` |
| `REPORT_TYPE_VIOLATION` | Auto-labels for illegal content reports | `illegal-content` |
| `REPORT_TYPE_OTHER` | Auto-labels for "other" reports | `(leave empty)` |

## Acknowledgments

This project was built with insights from these excellent tools:

- [ozone-discord-poster](https://github.com/bikesky-social/ozone-discord-poster) - Provided the Ozone API patterns and report monitoring approach
- [bsky-community-bot](https://github.com/bikesky-social/bsky-community-bot) - Demonstrated AT Protocol labeling and moderation event handling