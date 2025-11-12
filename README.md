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

1. Copy `.env.example` to `.env`
2. Fill in your labeler credentials and Ozone URL
3. Add whitelisted moderator DIDs (comma-separated)
4. Run with `docker compose up`

## Environment Variables

- `BSKY_LABELER_USERNAME` - Your labeler's handle
- `BSKY_LABELER_PASSWORD` - App password for labeler
- `BSKY_LABELER_DID` - DID of your labeler
- `OZONE_URL` - URL to your Ozone server
- `POLLING_SECONDS` - How often to check for reports (default: 30)
- `WHITELISTED_MODERATORS` - Comma-separated DIDs of trusted moderators
- `REPORT_TYPE_MISLEADING` - Labels for misleading content reports
- `REPORT_TYPE_SPAM` - Labels for spam reports
- `REPORT_TYPE_SEXUAL` - Labels for sexual content reports
- `REPORT_TYPE_RUDE` - Labels for rude/harassment reports
- `REPORT_TYPE_VIOLATION` - Labels for illegal content reports
- `REPORT_TYPE_OTHER` - Labels for "other" reports

## Acknowledgments

This project was built with insights from these excellent tools:

- [ozone-discord-poster](https://github.com/bikesky-social/ozone-discord-poster) - Provided the Ozone API patterns and report monitoring approach
- [bsky-community-bot](https://github.com/bikesky-social/bsky-community-bot) - Demonstrated AT Protocol labeling and moderation event handling