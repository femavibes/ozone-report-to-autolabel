# Planned Features

## Configurable Backfill Limit
- Add `BACKFILL_LIMIT` env variable to control how many recent events to fetch on startup
- Default: Current API default (unknown, needs investigation)
- Allows extending backfill window for environments with longer downtimes
- Example: `BACKFILL_LIMIT=500` to check last 500 events on restart
- Helps prevent missing reports during extended maintenance windows

## Auto-Ban System Enhancements
- Time-based violation windows (e.g., only count violations from last 30 days)
- Performance caching for moderation history queries (5-10 minute cache)
- Minimum account age requirements before auto-banning
- Progressive enforcement (temp bans before permanent bans)
- Appeal/review process integration

## Feed Analysis System
- Analyze removed posts to identify why off-topic content matched feed criteria
- Track regex false positives and user list accuracy
- Identify temporal patterns and topic drift
- Generate feedback reports for feed algorithm improvements

## Future Enhancements
- Rate limiting for notifications (prevent spam during API issues)
- Batch notifications (collect multiple failures into single DM)
- Health check endpoint improvements
- Metrics/monitoring integration