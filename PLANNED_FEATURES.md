# Planned Features

## Configurable Backfill Limit
- Add `BACKFILL_LIMIT` env variable to control how many recent events to fetch on startup
- Default: Current API default (unknown, needs investigation)
- Allows extending backfill window for environments with longer downtimes
- Example: `BACKFILL_LIMIT=500` to check last 500 events on restart
- Helps prevent missing reports during extended maintenance windows

## Future Enhancements
- Rate limiting for notifications (prevent spam during API issues)
- Batch notifications (collect multiple failures into single DM)
- Health check endpoint improvements
- Metrics/monitoring integration