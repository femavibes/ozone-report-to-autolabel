# Auto-Ban System Implementation

## Overview
Successfully implemented an automated account labeling system that tracks moderation violations and applies account labels when users exceed configurable thresholds.

## Key Features

### 1. Threshold-Based Account Labeling
- Tracks post-level moderation labels applied to users
- Configurable thresholds per label type (e.g., `clutter:5:2`)
- Caps cross-contamination from other violation types
- Applies account labels automatically when thresholds are met

### 2. Smart Counting Logic
- Queries Ozone moderation history for accurate label counts
- Handles label removals by calculating net counts (additions - removals)
- Only counts labels defined in `MODLABELS` configuration
- Prevents gaming by limiting how other violations contribute

### 3. Database-Free Design
- Uses Ozone's moderation history as source of truth
- No additional storage requirements
- Automatically handles label removal scenarios
- Scales with existing Ozone infrastructure

## Configuration

### Environment Variables
```env
# Define which labels are moderation labels
MODLABELS="clutter,spam,harassment,misleading"

# Auto-ban thresholds: label:threshold:otherCap
AUTOBAN="clutter:5:2,spam:3:1,harassment:2:0"
```

### Threshold Format
`label:threshold:otherCap`
- **label**: The primary violation type
- **threshold**: Total points needed to trigger account label
- **otherCap**: Maximum points that can come from other mod labels

### Example Logic
For `clutter:5:2`:
- User needs 5 total points
- Each clutter label = 1 point (unlimited)
- Each other mod label = 1 point (max 2 can count)
- So: 3 clutter + 2 spam = 5 points = triggers account label

## Integration Points

### 1. LabelApplier Integration
- Triggers threshold check after successful post label application
- Only checks when mod labels are applied (not all labels)
- Extracts post author DID from subject URI automatically

### 2. AutoBanChecker Class
- Handles all threshold logic and Ozone API calls
- Parses configuration and validates rules
- Applies account labels when thresholds are met
- Comprehensive error handling and logging

### 3. Ozone API Usage
- Queries moderation history: `tools.ozone.moderation.queryEvents`
- Applies account labels: `tools.ozone.moderation.emitEvent`
- Uses existing authentication and proxy headers

## Benefits

### 1. Flexible Enforcement
- Different thresholds for different violation types
- Prevents users from gaming the system by mixing violations
- Allows for zero-tolerance policies (harassment:2:0)

### 2. Accurate Tracking
- Real-time updates based on actual moderation actions
- Handles edge cases like label removals automatically
- No data synchronization issues

### 3. Seamless Integration
- Works with existing label→list→feed pipeline
- Multiple account labels supported (spam + clutter + harassment)
- No changes needed to other tools in the ecosystem

## Future Enhancements
- Time-based violation windows (30-day rolling periods)
- Performance caching for frequent queries
- Progressive enforcement (temp → permanent bans)
- Minimum account age requirements
- Appeal/review process integration

## Testing
The implementation has been tested with various scenarios:
- Pure violations (5 clutter posts)
- Mixed violations (4 clutter + 2 spam)
- Cross-contamination limits (3 clutter + 3 spam)
- Zero-tolerance enforcement (2 harassment posts)
- Below-threshold scenarios

All tests pass and the logic correctly handles edge cases and multiple simultaneous account label applications.