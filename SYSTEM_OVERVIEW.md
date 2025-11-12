# Ozone Report to Auto-Label System Overview

## Purpose
Automates Bluesky moderation by allowing whitelisted moderators to apply/remove labels through reports instead of manually using Ozone. Moderators can moderate directly from their timeline without context switching.

## Core Concept
- Whitelisted moderators report posts/accounts
- App monitors Ozone for new reports from trusted users
- Parses report comments for label commands OR uses report type for auto-labeling
- Applies labels through Ozone API
- Auto-closes reports on success, sends DM notifications on failure

## Architecture

### Main Components
1. **index.ts** - Main application, report monitoring loop
2. **CommandParser.ts** - Parses "add label1,label2" syntax from comments
3. **LabelApplier.ts** - Applies/removes labels through Ozone API
4. **NotificationService.ts** - Sends DM notifications on errors

### Data Flow
```
Report Created → Whitelist Check → Command Parse → Label Validation → Apply Labels → Resolve Report
                                                                    ↓ (on failure)
                                                              Send Error DM
```

## Command Syntax

### Comment Commands (in "Other" reports)
- `add label1` - Apply label1 to reported item
- `add label1,label2` - Apply multiple labels
- `add-account label1` - Force apply to account (even when reporting post)
- `add-post label1` - Force apply to post (even when reporting account)
- `add-a` / `add-p` - Shortcuts for above
- `remove label1` - Remove label1 from reported item
- `remove-account label1` - Force remove from account
- `remove-post label1` - Force remove from post
- `remove-a` / `remove-p` - Shortcuts for above

### Report Type Auto-Labels
- Select "Spam" → Auto-applies configured spam labels
- Select "Misleading" → Auto-applies configured misleading labels
- etc. (configured via REPORT_TYPE_* env vars)

## Environment Configuration

### Authentication
- `BSKY_LABELER_*` - Labeler account for Ozone operations
- `BSKY_DM_*` - Account for sending DM notifications (can be same as labeler)

### Core Settings
- `OZONE_URL` - Your Ozone server
- `WHITELISTED_MODERATORS` - DIDs of trusted moderators (comma-separated)
- `VALID_LABELS` - Labels that can be applied (comma-separated)

### Auto-Labeling
- `REPORT_TYPE_SPAM` - Labels applied when "Spam" report type selected
- `REPORT_TYPE_MISLEADING` - Labels for "Misleading" reports
- etc.

### Notifications
- `MODERATOR_NOTIFICATIONS` - Optional overrides (defaults to DM for all whitelisted)

## Technical Implementation

### Ozone Integration
- Uses `agent.tools.ozone.moderation.queryEvents()` to poll for reports
- Authenticates with `atproto-proxy` header: `${labelerDid}#atproto_labeler`
- Filters for `tools.ozone.moderation.defs#modEventReport` events
- Applies labels with `tools.ozone.moderation.defs#modEventLabel`
- Resolves reports with `tools.ozone.moderation.defs#modEventAcknowledge`

### Chat/DM Integration
- Uses `https://api.bsky.chat` endpoint (NOT bsky.social)
- Direct HTTP requests for chat API calls
- Token refresh logic for expired sessions
- Rich text facets for clickable links in DMs

### Error Handling
- **Individual label processing** - If "add label1,invalidlabel" → label1 succeeds, invalidlabel fails
- **Partial failure handling** - Report stays open if any labels fail
- **Retry logic** - Network errors retry 3x with exponential backoff, invalid labels fail immediately
- **Graceful degradation** - App continues working even if DMs fail

### Session Management
- **Both agents** (Ozone + DM) have token refresh logic
- **Automatic re-authentication** on token expiration
- **Session persistence** for long-running operations

## Key Features

### Backfill Processing
- On startup, processes ALL pending reports (not just new ones)
- Catches up on missed reports if app was down

### Smart Report Resolution
- Only closes reports if ALL labels succeed
- Keeps reports open for manual review if any labels fail

### Audit Trail
- All label events include "Auto-added/removed by @moderatorhandle" in Ozone
- Shows which moderator triggered each auto-action

### Notification Strategy
- **Success** - Silent (no notification)
- **Failure** - DM with error details + clickable report link
- **Partial failure** - DM shows which labels failed/succeeded

## Development Notes

### Inspired By
- [ozone-discord-poster](https://github.com/bikesky-social/ozone-discord-poster) - Ozone API patterns
- [bsky-community-bot](https://github.com/bikesky-social/bsky-community-bot) - AT Protocol labeling

### Key Learnings
- Labeler accounts CAN use chat API (contrary to initial assumption)
- Chat API requires `https://api.bsky.chat` endpoint
- Ozone requires `cid` property in subject for label operations
- Report types come as full AT Protocol identifiers (e.g., `com.atproto.moderation.defs#reasonSpam`)

### Common Issues
- **"Bad token method"** - Wrong chat API endpoint (use api.bsky.chat)
- **"Input/subject must have property cid"** - Use original reportedSubject from event
- **"XRPCNotSupported"** - Wrong HTTP method or endpoint for chat API
- **"ExpiredToken"** - Need token refresh logic

## File Structure
```
src/
├── index.ts              # Main app, report monitoring
├── CommandParser.ts      # Parse "add label1,label2" syntax
├── LabelApplier.ts       # Apply/remove labels via Ozone
└── NotificationService.ts # Send DM notifications
```

## Future Enhancement Ideas
- Multiple notification methods (Discord, webhooks)
- Metrics/stats tracking
- Multiple labeler support
- Web dashboard for configuration
- Batch processing optimization