# Toilet Stall Wall - Implementation Plan

## Overview

A minimal PWA simulating a public bathroom stall wall with ephemeral, anonymous graffiti. Three globally-shared walls rendered in 3D perspective, finger-drawing only, decay over time.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Vercel Postgres (managed, serverless-friendly)
- **3D Layout**: CSS 3D transforms (perspective, preserve-3d)
- **Canvas**: HTML Canvas API for drawing and rendering graffiti
- **Styling**: Tailwind CSS
- **State**: React state + polling (no WebSockets)

### Why This Stack?

- **Vercel Postgres**: Zero-config with Vercel hosting, scales automatically, familiar SQL.
- **CSS 3D transforms**: Lightweight 3D for positioning flat wall surfaces in perspective. No WebGL overhead.
- **Next.js App Router**: API routes alongside frontend, easy PWA setup.

---

## Data Model

### `graffiti` table (Vercel Postgres)

```sql
CREATE TABLE graffiti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall TEXT NOT NULL,              -- 'front' | 'left' | 'right'
  implement TEXT NOT NULL,         -- 'scribble' | 'marker' | 'carved'
  stroke_data JSONB NOT NULL,      -- array of strokes, each stroke is array of {x, y}
  color TEXT NOT NULL,             -- hex color
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_graffiti_wall ON graffiti(wall);
CREATE INDEX idx_graffiti_expires ON graffiti(expires_at);
```

### Decay Durations (Configurable via env vars)

```
SCRIBBLE_DURATION_MS = 4 * 60 * 60 * 1000      // 4 hours
MARKER_DURATION_MS = 24 * 60 * 60 * 1000       // 1 day
CARVED_DURATION_MS = 7 * 24 * 60 * 60 * 1000   // 1 week
```

---

## Session Management

**Session = browser session with 2-minute inactivity timeout**

- Generate anonymous session ID on first visit (stored in sessionStorage)
- Track `lastActivityTimestamp` in sessionStorage
- On any interaction, update timestamp
- If `now - lastActivity > 2 minutes`, generate new session ID
- Track `hasPostedThisSession` boolean in sessionStorage
- When session resets, `hasPostedThisSession` resets to false

No cookies. No localStorage persistence. No server-side session tracking.

---

## 3D Stall Layout

### Concept

The stall is a 3D box rendered with CSS transforms. User is positioned at center, looking at walls.

```
         CEILING (v2)
            ┌─────┐
           /       \
          /         \
    LEFT /   FRONT   \ RIGHT
    WALL│    WALL     │WALL
        │             │
        │             │
         \           /
          \  FLOOR  /
           \ (v2)  /
            └─────┘
         (toilet visible)
```

### CSS 3D Implementation

```css
.stall-container {
  perspective: 1000px;
  perspective-origin: center center;
}

.stall-room {
  transform-style: preserve-3d;
  transition: transform 0.4s ease-out;
}

/* Rotation states */
.stall-room.facing-front { transform: rotateY(0deg); }
.stall-room.facing-left { transform: rotateY(45deg); }
.stall-room.facing-right { transform: rotateY(-45deg); }

/* Wall positioning */
.wall-front {
  transform: translateZ(-300px);
}
.wall-left {
  transform: rotateY(90deg) translateZ(-300px);
}
.wall-right {
  transform: rotateY(-90deg) translateZ(-300px);
}
```

### Interaction

- **Swipe left**: Rotate room to face left wall
- **Swipe right**: Rotate room to face right wall
- **Swipe up** (v2): Tilt up to see ceiling with fluorescent lights
- **Swipe down** (v2): Tilt down to see floor and toilet

For v1: Only horizontal rotation (Y-axis). Vertical tilt deferred.

### Visual Style

- **Wall proportions**: Taller than wide (~1:1.5 or 2:3 ratio), like real stall walls
- **Front wall (door)**: Has a visible sliding bolt lock mechanism at eye level
  - Classic horizontal bolt with knob
  - Red/green "occupied" indicator circle
  - Immediately communicates "bathroom stall" without explanation
- **Side walls**: Plain, same texture, no lock
- **Texture**: Off-white/beige with subtle dirty paint, minor stains
- Visible perspective gives depth cues
- Slight vignette/shadow at edges

---

## Viewing Experience

### Default State

- User faces front wall
- Left and right walls visible at perspective angles
- All three walls show their graffiti rendered on canvas
- Poll server every 30s for updates

### Graffiti Rendering

Each wall has a canvas that renders all graffiti for that wall:
- Iterate through graffiti array
- Draw each stroke with appropriate style (thickness, color, opacity)
- Opacity calculated from age:
  - Scribble/Marker: Linear fade from 1.0 → 0.3 over lifespan
  - Carved: Always 1.0 (doesn't fade visually, just expires)

---

## Interaction Flow

### Writing

1. Tap "Write on the wall"
2. **If already posted this session**: Brief message "You already left your mark" (2s, dismiss)
3. **If can post**: Enter drawing mode
   - Current focused wall goes full-screen (exits 3D view temporarily)
   - Bottom toolbar: `[Scribble] [Marker] [Carved]` + `[Done]`
   - Default: Scribble selected
4. Draw with finger
5. Tap "Done" → submit → return to 3D view
6. Mark `hasPostedThisSession = true`

### Implement Behaviors

| Implement | Line Style | Velocity Constraint | Color | Duration |
|-----------|-----------|---------------------|-------|----------|
| Scribble | Thin (2px), slightly wobbly (pencil-like) | None | Dark gray #555 | 4 hours |
| Marker | Thick (6px), smooth, solid | None | Jet black #000 | 1 day |
| Carved | Thin (1.5px), jagged/scratchy | Must move slowly | Wall shadow #8B8685 | 1 week |

### Carved Mode Mechanics

```javascript
// On touch move
const velocity = distance / timeDelta;
if (velocity > CARVE_VELOCITY_THRESHOLD) {
  // Too fast - don't add point, line breaks
  return;
}
// Slow enough - add point to stroke
```

This naturally creates the "you have to work for it" friction without error messages.

---

## API Routes

### `GET /api/graffiti?wall=front`

Returns all non-expired graffiti for specified wall.

```json
{
  "graffiti": [
    {
      "id": "uuid-here",
      "implement": "marker",
      "strokeData": [[{"x": 0.1, "y": 0.2}, {"x": 0.15, "y": 0.25}]],
      "color": "#111111",
      "createdAt": "2024-01-04T12:00:00Z",
      "opacity": 0.7
    }
  ]
}
```

Coordinates stored as 0-1 ratios (percent of wall), rendered to actual pixels client-side.

### `POST /api/graffiti`

```json
{
  "wall": "front",
  "implement": "scribble",
  "strokeData": [[{"x": 0.1, "y": 0.2}, ...]],
  "color": "#555555"
}
```

Returns: `{ "id": "uuid", "success": true }`

### Cleanup (Vercel Cron)

Vercel cron job runs hourly to delete expired graffiti:
```sql
DELETE FROM graffiti WHERE expires_at < NOW();
```

---

## File Structure

```
toilet/
├── app/
│   ├── layout.tsx              # Root layout, PWA meta tags
│   ├── page.tsx                # Main (only) page
│   ├── globals.css             # Tailwind + 3D styles + textures
│   └── api/
│       ├── graffiti/
│       │   └── route.ts        # GET and POST handlers
│       └── cron/
│           └── cleanup/
│               └── route.ts    # Vercel cron cleanup endpoint
├── components/
│   ├── StallView.tsx           # 3D room container with rotation
│   ├── Wall.tsx                # Single wall with canvas
│   ├── DrawingMode.tsx         # Full-screen drawing overlay
│   └── ImplementPicker.tsx     # Scribble/Marker/Carved toolbar
├── lib/
│   ├── db.ts                   # Vercel Postgres queries
│   ├── session.ts              # Session ID + activity tracking
│   ├── config.ts               # Decay durations from env
│   └── drawing.ts              # Stroke processing, velocity calc
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── icon-192.png
│   ├── icon-512.png
│   └── textures/
│       └── wall-texture.png    # Subtle wall texture
├── vercel.json                 # Cron job config
└── package.json
```

---

## Implementation Phases

### Phase 1: Project Setup
- [ ] Initialize Next.js 14 with App Router
- [ ] Configure Tailwind CSS
- [ ] Set up Vercel Postgres (local dev with `.env.local`)
- [ ] Create database schema
- [ ] Create config file with decay durations

### Phase 2: API Layer
- [ ] Implement GET /api/graffiti (with opacity calculation)
- [ ] Implement POST /api/graffiti (with expiry calculation)
- [ ] Set up Vercel cron for cleanup
- [ ] Test API with sample data

### Phase 3: 3D Viewing Experience
- [ ] Build StallView with CSS 3D transforms
- [ ] Position three walls in 3D space
- [ ] Implement swipe-to-rotate with easing
- [ ] Add wall texture styling
- [ ] Render graffiti on wall canvases
- [ ] Set up 30s polling for updates

### Phase 4: Drawing Experience
- [ ] Build DrawingMode full-screen overlay
- [ ] Implement finger drawing on canvas
- [ ] Add ImplementPicker toolbar
- [ ] Implement scribble style (thin, wobbly)
- [ ] Implement marker style (thick, smooth)
- [ ] Implement carved style (velocity-gated)
- [ ] Submit drawing to API

### Phase 5: Session Logic
- [ ] Generate/manage session ID in sessionStorage
- [ ] Track last activity timestamp
- [ ] Implement 2-minute timeout reset
- [ ] Enforce one-post-per-session
- [ ] Show "already posted" message

### Phase 6: Polish & PWA
- [ ] Add PWA manifest.json
- [ ] Add service worker (offline shell)
- [ ] Add appropriate meta tags for mobile
- [ ] Test on actual mobile devices
- [ ] Tune touch sensitivity and 3D perspective values
- [ ] Add subtle visual polish (shadows, vignette)

---

## v2 Ideas (Deferred)

- **Vertical look**: Swipe up for ceiling (fluorescent lights), down for floor (toilet)
- **Sound**: Subtle ambient bathroom sounds (optional, off by default)
- **Stall variations**: Different stall "rooms" with slightly different textures

---

## Hosting

**Vercel** with:
- Vercel Postgres for database
- Vercel Cron for cleanup job
- Edge functions for API routes

---

## Definition of Done (from PRD)

- [x] One screen
- [ ] Three walls (in 3D perspective)
- [ ] Scribble + marker + carve
- [ ] One post per session
- [ ] Visible decay over time
- [x] No accounts
- [x] No likes
- [x] No explanations

Ship when all boxes checked.
