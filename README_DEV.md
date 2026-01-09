# Developer Documentation

## Hidden Features & Debug Tools

### Debug Panel
Press the **backtick key (`)** to toggle the debug panel overlay. This panel provides:

- **Graffiti Management**
  - View count of current graffiti on each wall (Front, Left, Right)
  - "Clear All Graffiti" button to delete all graffiti from the database
  - Useful for testing and resetting the canvas during development

- **Selective Graffiti Removal**
  - Click individual graffiti strokes to remove them
  - Each graffiti gets a clickable hitbox overlay when debug panel is open
  - Great for cleaning up specific test drawings

**Location:** [components/DebugPanel.tsx](components/DebugPanel.tsx)

### Analytics Dashboard
Visit `/admin` to access the password-protected analytics dashboard.

**Features:**
- Total sessions (unique visitors)
- Average drawings per session
- Implement usage statistics with decay times
- Wall rotation heatmap (shows user navigation patterns)
- Graffiti distribution by wall and implement
- Activity timeline (last 7 days)

**Authentication:**
- Set admin password via `ADMIN_PASSWORD` environment variable
- Default password: `admin123` (change this in production!)
- Uses simple Bearer token authentication via Authorization header

**Location:** [app/admin/page.tsx](app/admin/page.tsx)

## Database Setup

### First-Time Initialization
Visit `/api/init` to create the required database tables:
- `graffiti` - Stores all wall drawings with expiration timestamps
- `analytics_events` - Tracks user behavior events

This endpoint is idempotent (safe to call multiple times).

**Location:** [app/api/init/route.ts](app/api/init/route.ts)

### Database Schema

**graffiti table:**
```sql
id UUID PRIMARY KEY
wall TEXT (front/left/right)
implement TEXT (scribble/marker/carved/whiteout)
stroke_data JSONB (array of stroke coordinates)
color TEXT (hex color)
created_at TIMESTAMPTZ
expires_at TIMESTAMPTZ (calculated based on implement decay duration)
```

**analytics_events table:**
```sql
id UUID PRIMARY KEY
session_id TEXT (client-side generated)
event_type TEXT (session_start, wall_rotation, implement_selected, etc.)
metadata JSONB (event-specific data)
created_at TIMESTAMPTZ
```

**Location:** [lib/db.ts](lib/db.ts)

## Implement Types & Configuration

### Available Implements
1. **Pencil** (internal: `scribble`)
   - Color: `#555555` (dark gray)
   - Line width: 2px
   - Decay: 4 hours
   - Best for: Quick sketches

2. **Marker**
   - Color: `#d94f30` (orange-red)
   - Line width: 4px
   - Decay: 24 hours (1 day)
   - Best for: Bold statements

3. **Carved**
   - Color: `#a39d98` (light gray)
   - Line width: 2px with shadow
   - Decay: 7 days (1 week)
   - Velocity threshold: Must draw slowly (0.15 px/ms)
   - Best for: Permanent-looking engravings

4. **Whiteout**
   - Color: `#ffffff` (pure white)
   - Line width: 12px (thick)
   - Decay: 2 hours
   - Best for: Covering existing graffiti

### Configuring Decay Durations
Set environment variables to override default decay times:

```bash
SCRIBBLE_DURATION_MS=14400000  # 4 hours (default)
MARKER_DURATION_MS=86400000    # 1 day (default)
CARVED_DURATION_MS=604800000   # 7 days (default)
WHITEOUT_DURATION_MS=7200000   # 2 hours (default)
```

**Location:** [lib/config.ts](lib/config.ts)

## Analytics Event Tracking

### Tracked Events

**session_start**
```typescript
trackEvent('session_start');
// Metadata: none
// Fired: On component mount (once per session)
```

**wall_rotation**
```typescript
trackEvent('wall_rotation', { from: 'front', to: 'left' });
// Metadata: { from: WallType, to: WallType }
// Fired: When user rotates view left/right
```

**implement_selected**
```typescript
trackEvent('implement_selected', { implement: 'marker' });
// Metadata: { implement: ImplementType }
// Fired: When user selects a drawing tool
```

**drawing_started**
```typescript
trackEvent('drawing_started', { wall: 'front', implement: 'marker' });
// Metadata: { wall: WallType, implement: ImplementType }
// Fired: When user begins drawing (first pointer down)
```

**drawing_submitted**
```typescript
trackEvent('drawing_submitted', {
  wall: 'front',
  implement: 'marker',
  strokeCount: 3
});
// Metadata: { wall: WallType, implement: ImplementType, strokeCount: number }
// Fired: When drawing is successfully saved to database
```

**Location:** [components/StallView3D.tsx](components/StallView3D.tsx)

## Session Management

### Session ID Generation
- Client-side UUID stored in `localStorage`
- Key: `bathroom_session_id`
- Persists across page reloads
- Used for analytics correlation

**Location:** [lib/session.ts](lib/session.ts)

### Session Timeout
- Inactivity timeout: 2 minutes (configurable via `SESSION_TIMEOUT_MS`)
- After timeout, session is considered ended
- New session_start event tracked on next interaction

## Graffiti Rendering & Decay

### Opacity Calculation
Graffiti fades linearly over time:
```typescript
opacity = 1 - (elapsedTime / totalDecayDuration)
```

- Calculated client-side in real-time
- Allows smooth fade-out animation
- Graffiti deleted from DB when `expires_at < NOW()`

**Location:** [lib/utils.ts](lib/utils.ts) - `calculateOpacity()`

### Polling Interval
- New graffiti fetched every 30 seconds (configurable via `POLL_INTERVAL_MS`)
- Keeps all users' views in sync
- Shows fading graffiti from other users

## API Endpoints

### Public Endpoints
- `GET /api/graffiti?wall={wall}` - Fetch graffiti for a wall
- `POST /api/graffiti` - Submit new graffiti
- `POST /api/analytics` - Track analytics event
- `GET /api/init` - Initialize database tables

### Protected Endpoints
- `GET /api/admin/stats` - Get analytics statistics
  - Requires: `Authorization: Bearer {ADMIN_PASSWORD}` header

## Environment Variables

```bash
# Database (required)
POSTGRES_URL="your-vercel-postgres-url"

# Admin Access (recommended to change)
ADMIN_PASSWORD="admin123"

# Decay Durations (optional)
SCRIBBLE_DURATION_MS=14400000
MARKER_DURATION_MS=86400000
CARVED_DURATION_MS=604800000
WHITEOUT_DURATION_MS=7200000

# Other Config (optional)
SESSION_TIMEOUT_MS=120000    # 2 minutes
POLL_INTERVAL_MS=30000       # 30 seconds
```

## Development Workflow

### Local Testing
1. Start dev server: `npm run dev`
2. Visit `http://localhost:3000`
3. Press `` ` `` to open debug panel
4. Test drawing on each wall
5. Visit `/admin` to check analytics

### Resetting Test Data
```bash
# Option 1: Use debug panel
# Press ` and click "Clear All Graffiti"

# Option 2: Direct database access
# Connect to your Postgres instance and run:
DELETE FROM graffiti;
DELETE FROM analytics_events;
```

### Common Issues

**"Analytics table doesn't exist"**
- Solution: Visit `/api/init` to create tables

**"Failed to submit graffiti"**
- Check browser console for validation errors
- Ensure implement type is valid (scribble/marker/carved/whiteout)
- Check database connection

**Debug panel not showing**
- Press backtick (`) key on keyboard
- Check console for JavaScript errors
- Verify [components/DebugPanel.tsx](components/DebugPanel.tsx) is imported

## Architecture Notes

### Why client-side session IDs?
- No user authentication required
- Privacy-focused (no personal data)
- Enables basic analytics without cookies
- Simple implementation

### Why linear fade instead of exponential?
- More predictable for users
- Easier to calculate and render
- Creates visual "history" effect

### Why JSONB for stroke data?
- Flexible schema for future implement types
- Efficient storage for coordinate arrays
- Native Postgres support for JSON queries

## Testing Checklist

- [ ] Draw with each implement type
- [ ] Verify decay times match config
- [ ] Rotate through all walls
- [ ] Submit multiple drawings
- [ ] Wait for graffiti to fade
- [ ] Check analytics dashboard
- [ ] Test debug panel clear function
- [ ] Verify selective removal works
- [ ] Test on mobile viewport
- [ ] Check accessibility (keyboard nav)

## File Structure Reference

```
app/
├── admin/page.tsx              # Analytics dashboard
├── api/
│   ├── graffiti/route.ts      # Graffiti CRUD
│   ├── analytics/route.ts     # Event tracking
│   ├── admin/stats/route.ts   # Analytics stats
│   └── init/route.ts          # Database setup

components/
├── StallView3D.tsx            # Main bathroom scene
├── DebugPanel.tsx             # Debug overlay (` key)
├── ImplementPicker.tsx        # Tool selector
└── icons/ImplementIcons.tsx   # Tool icons

lib/
├── db.ts                      # Database functions
├── config.ts                  # Implement & decay config
├── analytics.ts               # Client analytics helper
├── session.ts                 # Session ID management
└── utils.ts                   # Opacity calculation
```
