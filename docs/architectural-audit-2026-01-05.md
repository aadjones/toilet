# Architectural Audit - Toilet Stall Graffiti App
**Date:** January 5, 2026
**Auditor:** Senior Software Architect
**Codebase Version:** Post-Three.js migration

---

## Executive Summary

This codebase is in a **transitional state** following a recent migration from CSS 3D transforms to Three.js. While the core functionality is sound and the code is generally well-organized, there are **immediate cleanup opportunities** and **architectural inconsistencies** that need attention before they become technical debt.

**Critical Finding:** You have TWO complete 3D rendering implementations (`StallView.tsx` using CSS 3D and `StallView3D.tsx` using Three.js), but only one is actively used. This is a 40% code waste and a maintenance trap.

**Risk Level:** Medium - The app works, but maintaining parallel implementations will cause problems when you need to add features or fix bugs.

---

## 1. Code Organization & Separation of Concerns

### IMMEDIATE CONCERNS

#### Dead Code: CSS 3D Implementation Still Present
**File:** `/Users/adj/Documents/Code/app-development/toilet/components/StallView.tsx` (373 lines)
**Status:** UNUSED - The app imports `StallView3D`, not `StallView`

**What's broken now:**
- 373 lines of production-quality code sitting idle
- Future developers (including you in 3 months) will waste time trying to understand which implementation is active
- When you add features to `StallView3D`, someone might accidentally add them to `StallView` too

**Why this will hurt in 6-12 months:**
- If you need to add a new wall or feature, you'll either:
  1. Accidentally modify the wrong file and wonder why nothing changes
  2. Maintain both implementations "just in case," doubling your maintenance burden
  3. Spend 20 minutes every time re-learning which one is actually used

**Blast radius:** Low now, but grows exponentially as features are added. Every new feature becomes 2x work if you maintain both.

#### Wall Component Has Two Responsibilities
**File:** `/Users/adj/Documents/Code/app-development/toilet/components/Wall.tsx`

The `Wall` component does two things:
1. **Rendering graffiti on canvas** (core responsibility)
2. **Rendering the stall door lock UI** (presentational detail)

**What breaks when this scales:**
Currently used only by the CSS 3D version (which is dead code). The Three.js version (`StallView3D.tsx`) creates wall textures directly via `createWallTexture()` function - it doesn't use the `Wall` component at all.

This means you have **two completely different wall rendering pipelines**:
- CSS 3D path: `Wall` component with DOM-based canvas
- Three.js path: `createWallTexture()` function with programmatic canvas

**Future pain points:**
- Want to change how the lock looks? You have to modify two places (lines 113-141 in `Wall.tsx` AND lines 58-81 in `StallView3D.tsx`)
- Want to change wall color/texture? Two places again
- Want to add stains or wear patterns? You guessed it - two implementations

### RECOMMENDED PATH FORWARD

**Action 1: Delete StallView.tsx**
```bash
rm /Users/adj/Documents/Code/app-development/toilet/components/StallView.tsx
```

**Why:** You migrated to Three.js for a reason. The CSS 3D version served its purpose during development. Delete it. If you need it later, it's in git history.

**Action 2: Extract Lock Rendering to Shared Function**
Create a new file: `/Users/adj/Documents/Code/app-development/toilet/lib/wall-rendering.ts`

Move lock rendering logic from both `Wall.tsx` and `StallView3D.tsx` into shared functions like:
```typescript
export function renderLockOnCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void
export function renderWallTexture(ctx: CanvasRenderingContext2D, width: number, height: number): void
```

Then `Wall.tsx` (if kept for any reason) and `StallView3D.tsx` both call these. **One source of truth.**

**Action 3: Decide Wall.tsx's Fate**

Since `StallView3D.tsx` doesn't use the `Wall` component at all, you have two options:

**Option A (Recommended):** Delete `Wall.tsx` entirely. It's not being used.

**Option B:** Keep it ONLY if you plan to support a fallback non-WebGL mode for ancient devices. In that case:
- Rename it to `WallFallback.tsx` to make the intent clear
- Document at the top of the file: "Fallback for browsers without WebGL support"
- Extract shared rendering logic (lock, texture) to shared functions

My strong recommendation: **Delete it.** You're using Three.js. If someone's device doesn't support WebGL, they probably can't run a modern web app anyway.

---

## 2. Modularity & Refactorability

### IMMEDIATE CONCERNS

#### Canvas Texture Generation Lives in Component File
**File:** `/Users/adj/Documents/Code/app-development/toilet/components/StallView3D.tsx`
**Lines:** 23-181 (158 lines of pure rendering logic)

You have three canvas texture generation functions (walls, floor, ceiling) living inside a React component file. These are **pure functions** with zero React dependencies.

**What's wrong with this:**
- Component files should coordinate UI, not implement rendering algorithms
- If you want to test texture generation, you have to import a component
- If you want to reuse these functions elsewhere (e.g., a screenshot generator, an export feature), you can't without pulling in React/Three.js component baggage

**What happens when requirements evolve:**
You'll want to:
- Add different floor patterns (tiles vs. concrete)
- Make walls "dirtier" over time based on age
- Generate thumbnail previews for a wall gallery

All of these will bloat `StallView3D.tsx` further, turning it into a God component.

#### Graffiti Rendering Logic Duplicated in 3 Places
The logic for "draw strokes with implement-specific styles" appears in:
1. `StallView3D.tsx` lines 84-119 (`createWallTexture`)
2. `DrawingMode.tsx` lines 64-96 (redraw canvas)
3. `Wall.tsx` lines 36-79 (render graffiti)

**Duplication count:** 3 implementations of the same core algorithm.

**What will break:**
- Want to change how "carved" implements look jagged? You need to update 3 files.
- Want to add a new implement type "spraypaint" with fade effects? 3 files.
- Want to fix a bug where scribbles don't wobble correctly? 3 files.

**How you'll discover this bug in production:**
You'll fix the wobble in `DrawingMode.tsx` (where users see their drawing live), ship it, then get bug reports that the wobble looks different when they refresh the page (because the server returns graffiti rendered by the OTHER implementation in `StallView3D.tsx`).

### FUTURE PAIN POINTS

#### No Abstraction Between Three.js and Business Logic
`StallView3D.tsx` is 585 lines mixing:
- Three.js rendering (`Canvas`, `useFrame`, `mesh`, `planeGeometry`)
- Business logic (graffiti fetching, local state management)
- Camera controls
- Debug UI
- Touch gesture handling
- Texture generation

**This breaks down when you need to:**
- Switch to a different 3D library (R3F is great, but what if you need Babylon.js for AR features?)
- Add unit tests for graffiti state management
- Server-side render preview images
- Support multiple camera angles (bird's eye view, etc.)

All of these become major refactors instead of simple additions.

#### State Management Lives in Components
Graffiti state, facing direction, and transition state are all scattered across:
- `page.tsx` (mode, activeWall, message)
- `StallView3D.tsx` (facing, graffiti, isTransitioning, debug controls)
- Local refs for touch tracking

**What happens when this scales 10x:**
You'll want to add:
- Undo/redo for drawings
- Save drafts locally
- Share a specific wall via URL (deep linking)
- Analytics tracking (which walls get the most graffiti)

All of these require coordinating state across multiple components. Right now, there's no single source of truth. You'll end up lifting state up repeatedly until you finally admit you need a state management solution (Zustand, Jotai, etc.).

### RECOMMENDED PATH FORWARD

**Action 1: Extract Rendering to `/lib/wall-rendering.ts`**

Create a new module with pure functions:
```typescript
// /lib/wall-rendering.ts
export function renderGraffitiStrokes(
  ctx: CanvasRenderingContext2D,
  graffiti: Graffiti[],
  width: number,
  height: number
): void

export function createWallTexture(...): THREE.CanvasTexture
export function createFloorTexture(...): THREE.CanvasTexture
export function createCeilingTexture(...): THREE.CanvasTexture
```

**Why this is better:**
- One implementation of graffiti rendering, used everywhere
- Easy to test (just canvas operations, no React)
- Easy to reuse (export feature, thumbnails, etc.)
- Clear ownership (rendering logic lives in `/lib`, not scattered)

**Action 2: Extract Camera/Gesture Logic**

Create `/components/StallCamera.tsx` that handles ONLY:
- Camera rotation based on facing direction
- Touch gesture interpretation
- Keyboard controls

This separates "how the camera moves" from "what's being rendered."

**Action 3: Consider State Management Before You Need It**

You don't need Redux/Zustand TODAY, but set yourself up for it:
- Create `/lib/graffiti-state.ts` with functions that encapsulate state transformations
- Move fetch logic out of components
- Make components "dumb" - they receive data and callbacks, nothing more

**When you'll thank yourself:**
In 2-3 months when you add "favorites" or "report inappropriate graffiti" features. You'll be able to add state slices cleanly instead of threading props through 4 component layers.

---

## 3. World-View / Mental Model Consistency

### CURRENT MENTAL MODEL

The app has a **mostly consistent** mental model:

**Good Patterns:**
1. **Normalized coordinates (0-1 ratios)** - Stroke data stores positions as ratios, rendered to actual pixels client-side. This is correct and scales well.
2. **Wall-centric organization** - Everything is organized around the three walls (front, left, right). Consistent across DB, API, and UI.
3. **Implement-driven behavior** - Each implement type has visual and interactive properties. Centralized in `/lib/config.ts`.
4. **Session = browser tab lifespan** - Clear, simple model using sessionStorage.

**Inconsistent Patterns:**

#### Coordinates: Three.js Units vs. Pixels vs. Ratios
You're mixing three coordinate systems without clear boundaries:

1. **Graffiti strokes:** 0-1 ratios (good)
2. **CSS 3D (dead code):** Pixel-based (`wallDistance = 200px`)
3. **Three.js (active):** Unitless world space (`wallDistance = 1.5`)

**Where this causes confusion:**
In `StallView.tsx` (CSS version), you can understand the layout by reading pixel values: "walls are 200px away."

In `StallView3D.tsx`, values like `wallDistance = 1.5` are arbitrary units. Is that meters? Viewport units?

**Why this will bite you:**
When you add physics (graffiti dripping down walls) or AR features (real-world scale), you'll need to establish "1 unit = X meters." Right now, there's no documented conversion.

#### Opacity Calculation Lives in Two Places
Opacity fade is calculated:
1. **Server-side:** `/lib/db.ts` lines 44-56 (`getGraffitiForWall`)
2. **Client-side:** `/app/page.tsx` line 72 (sets `opacity: 1` for new graffiti)

**The inconsistency:**
- Existing graffiti: Opacity calculated on server based on age
- Newly created graffiti: Opacity hardcoded to `1` on client

**What breaks:**
If you change the opacity fade formula (e.g., make it exponential instead of linear), you have to remember to update the server. But newly created graffiti will still show `opacity: 1` until the next server fetch.

**This creates a flash:**
1. User draws graffiti → opacity 1.0 (client-side)
2. 10 seconds later, polling fetches from server → opacity recalculated (might be 0.95 if it's a fast decay implement)
3. User sees their graffiti suddenly get slightly lighter

#### Time: Timestamps as Strings vs. Numbers
**Database:** Returns timestamps as ISO strings (`row.created_at`)
**Client state:** Stores as strings (`createdAt: string` in Graffiti interface)
**Opacity calculation:** Converts to numbers (`new Date(row.created_at).getTime()`)

You're doing string → number → calculation every time. Why not store timestamps as numbers after the first fetch?

**What happens when this scales:**
You'll add features like "show age of graffiti on hover" or "sort by newest." Each will require parsing ISO strings repeatedly. This creates bugs like "why does sorting sometimes break?" (answer: string comparison vs. numeric comparison).

### RECOMMENDED PATH FORWARD

**Action 1: Document Coordinate Systems**

Add a comment at the top of `StallView3D.tsx`:
```typescript
/**
 * COORDINATE SYSTEM:
 * - Graffiti strokes: 0-1 ratios (portable across wall sizes)
 * - Three.js world space: 1 unit = ~1 meter
 * - Wall dimensions: 3m wide × 2m tall (typical bathroom stall)
 * - Camera at origin (0, 0, 0)
 */
```

**Action 2: Move Opacity Calculation to Client**

Remove opacity calculation from `/lib/db.ts`. Instead:
1. Server returns raw `created_at` and `expires_at`
2. Create `/lib/graffiti-rendering.ts` with:
```typescript
export function calculateOpacity(graffiti: Graffiti, now: number): number {
  // Single source of truth for opacity fade
}
```
3. Call this function wherever graffiti is rendered

**Why this is better:**
- Opacity updates smoothly as time passes (no server round-trip)
- Animations possible (graffiti fades in real-time)
- One calculation, used everywhere

**Action 3: Normalize Timestamp Handling**

Change `Graffiti` interface:
```typescript
export interface Graffiti {
  // ... other fields
  createdAt: number; // Unix timestamp in ms
  expiresAt: number; // Unix timestamp in ms
}
```

Convert once at the API boundary (`/app/api/graffiti/route.ts`), then work with numbers everywhere.

---

## 4. Technical Debt & Cleanup Opportunities

### CRITICAL CLEANUP NEEDED

#### 1. DEAD CODE: StallView.tsx
**File:** `/components/StallView.tsx`
**Lines:** 373
**Last used:** Never (since Three.js migration)
**Action:** DELETE

**Command:**
```bash
rm /Users/adj/Documents/Code/app-development/toilet/components/StallView.tsx
```

**Savings:**
- 373 fewer lines to maintain
- Eliminates confusion about which implementation is active
- Removes duplicated graffiti rendering logic

#### 2. DEAD CODE (maybe): Wall.tsx
**File:** `/components/Wall.tsx`
**Lines:** 152
**Used by:** `StallView.tsx` (which is dead code)
**Action:** DELETE (unless you have fallback plans)

**If you keep it:** Extract shared rendering logic first (see Section 1).

#### 3. LEGACY DEBUG CONTROLS
**Files:** Both `StallView.tsx` and `StallView3D.tsx`
**Lines:** ~120 lines combined of debug UI

Debug controls are GOOD during development. But they're scattered and duplicated.

**Problems:**
- Debug state (wallDistance, perspective, fov, cameraY) mixed with production state
- Keyboard handler for backtick (`) is production code just to toggle debug UI
- Debug panel HTML is ~80 lines in each component

**What will break:**
You'll forget to remove the backtick handler before shipping. A user will accidentally press it and see your debug panel. Not a disaster, but unprofessional.

**Recommended approach:**
1. Create `/components/DebugPanel.tsx` (shared component)
2. Only include it in development: `{process.env.NODE_ENV === 'development' && <DebugPanel />}`
3. Keep debug controls, but make them opt-in via URL param: `?debug=true`

**Why this is better:**
- Debug code clearly separated from production code
- Can share debug panels across components
- Won't accidentally ship debug UI to users
- Won't waste production bundle size on debug features

#### 4. MISSING CRON JOB FOR CLEANUP
**Plan says:** "Vercel cron job runs hourly to delete expired graffiti"
**Reality:** No cron job exists. No cleanup route exists.

**What's broken now:**
The database will fill with expired graffiti forever. You have a `cleanupExpiredGraffiti()` function in `/lib/db.ts` (line 90), but nothing calls it.

**When this becomes critical:**
After 1-2 months of production use, your database will be:
- 80% expired graffiti (dead data)
- Slow to query (scanning expired rows)
- Costing money (Vercel Postgres bills by storage)

**Required files (MISSING):**
```
/app/api/cron/cleanup/route.ts  (API endpoint)
/vercel.json                     (cron schedule config)
```

**Recommended implementation:**
```typescript
// /app/api/cron/cleanup/route.ts
import { NextResponse } from 'next/server';
import { cleanupExpiredGraffiti } from '@/lib/db';

export async function GET() {
  const deleted = await cleanupExpiredGraffiti();
  return NextResponse.json({ deleted, timestamp: new Date() });
}
```

```json
// /vercel.json
{
  "crons": [{
    "path": "/api/cron/cleanup",
    "schedule": "0 * * * *"
  }]
}
```

#### 5. UNUSED POLL_INTERVAL_MS CONSTANT
**File:** `/lib/config.ts` line 40
**Defined:** `POLL_INTERVAL_MS = 30 * 1000`
**Used:** NOWHERE

**Actual polling interval:** Hardcoded to `10000` (10 seconds) in `StallView3D.tsx` line 378.

**Impact:** Low, but confusing. Either use the constant or delete it.

**Fix:**
```typescript
// In StallView3D.tsx line 378
const interval = setInterval(fetchGraffiti, POLL_INTERVAL_MS);
```

#### 6. NO ERROR BOUNDARIES
**What happens when Three.js crashes:**
If there's a WebGL error (GPU driver crash, out of memory, etc.), the entire app white-screens with no recovery.

**Why this will hurt:**
Three.js errors happen more often than you think:
- Safari on old iPhones (limited WebGL contexts)
- Users with 50+ browser tabs (GPU memory exhausted)
- GPU driver bugs (especially on Android)

**Without error boundary:**
User sees blank screen, refreshes, blank screen again. They assume app is broken and leave.

**With error boundary:**
Show friendly message: "3D rendering failed. Try closing other tabs or refreshing."

**Recommended implementation:**
```typescript
// /components/ErrorBoundary.tsx
'use client';
export class ErrorBoundary extends React.Component { /* ... */ }
```

Wrap `<Canvas>` in `StallView3D.tsx`:
```typescript
<ErrorBoundary fallback={<div>3D rendering unavailable</div>}>
  <Canvas>...</Canvas>
</ErrorBoundary>
```

#### 7. NO LOADING STATES
**What happens on slow connections:**
1. User loads app
2. Sees empty stall walls for 5-10 seconds (waiting for graffiti fetch)
3. Graffiti pops in abruptly

**User perception:** "Is this app broken? Oh, there it is."

**Recommended addition:**
Add loading state in `StallView3D.tsx`:
```typescript
const [isLoading, setIsLoading] = useState(true);

// In fetchGraffiti:
setIsLoading(false);

// In render:
{isLoading && <div className="loading-spinner">Loading graffiti...</div>}
```

### MEDIUM-PRIORITY CLEANUP

#### 8. TYPE SAFETY: Magic Strings for Wall/Implement Types
**Current approach:**
```typescript
if (!['front', 'left', 'right'].includes(wall)) { ... }
```

Repeated in 3 places:
- `/app/api/graffiti/route.ts` lines 9, 39
- Validation logic duplicated

**Problem:**
If you add a fourth wall (back wall), you have to remember to update 3+ validation checks.

**Better approach:**
```typescript
// In /lib/config.ts
export const VALID_WALLS = ['front', 'left', 'right'] as const;
export const VALID_IMPLEMENTS = ['scribble', 'marker', 'carved'] as const;

// In validation:
if (!VALID_WALLS.includes(wall)) { ... }
```

**Even better approach (TypeScript brand checking):**
Use a validation function with type predicate:
```typescript
export function isValidWall(wall: string): wall is WallType {
  return VALID_WALLS.includes(wall as WallType);
}
```

#### 9. SESSION MANAGEMENT: Silent Session Resets
**Current behavior:**
When session times out (2 minutes inactivity), `getSessionId()` silently creates a new session and resets `hasPosted` flag.

**Problem:**
User doesn't know their session was reset. They might think:
- "Why can I post again? I thought it was one per session."
- Or worse: "Is my previous graffiti gone?"

**Recommended improvement:**
Show a toast notification when session resets:
```typescript
// In getSessionId()
if (sessionWasReset) {
  return { sessionId: newId, wasReset: true };
}

// In page.tsx
useEffect(() => {
  const { wasReset } = getSessionId();
  if (wasReset) {
    setMessage('Session reset. You can write again.');
  }
}, []);
```

#### 10. MIXED CONCERNS: Color Determined in Two Places
**Client-side:** `/app/page.tsx` line 71
```typescript
color: IMPLEMENT_STYLES[implement].color
```

**Server-side:** `/app/api/graffiti/route.ts` line 63
```typescript
const color = IMPLEMENT_STYLES[implement].color;
```

**Inconsistency:**
Client includes color in POST body (but it's ignored).
Server determines color from implement type.

**What will break:**
If you ever allow custom colors (e.g., "marker can be black, blue, or red"), the client will send the color but the server will override it.

**Better approach:**
Server should trust client color (with validation):
```typescript
// Server validates color is allowed for that implement
const allowedColors = IMPLEMENT_COLORS[implement]; // ['#000', '#00f', '#f00']
if (!allowedColors.includes(color)) {
  return error;
}
```

### LOW-PRIORITY CLEANUP

#### 11. INCONSISTENT NAMING: "Stall" vs. "Wall" vs. "Room"
**Variables named:**
- `stall-container`, `stall-room` (CSS classes in StallView.tsx)
- `StallView`, `StallView3D`, `StallGeometry` (components)
- But the actual objects are "walls" (`WallType`, `getGraffitiForWall`)

**Recommended:**
Decide if the mental model is "a stall containing walls" or "a room with walls."
Then make naming consistent. I recommend "stall" since that's the app name.

#### 12. MAGIC NUMBERS IN TEXTURE GENERATION
**Examples:**
- `canvas.width = 512` (why 512? Is that optimal for WebGL?)
- `const tileSize = 30` (why 30?)
- `const lightX = size - 50` (why 50?)

**Add constants:**
```typescript
const WALL_TEXTURE_SIZE = 512; // Power of 2 for WebGL efficiency
const FLOOR_TILE_SIZE = 30; // ~30px = visible tile on mobile
```

#### 13. NO MANIFEST ICONS
**File:** `/public/manifest.json` exists
**Icons:** Missing (no `icon-192.png`, `icon-512.png`)

**Impact:** PWA install won't work properly. Users will see default icon.

**Fix:** Generate icons and reference them in manifest.

---

## 5. Testing Philosophy

Given your testing philosophy (focused unit tests for core logic, behavioral not brittle, avoid complex mocking), here's what's WORTH testing in this codebase:

### RECOMMENDED TESTS

#### HIGH VALUE TESTS (Write These)

**1. Graffiti Opacity Calculation** (`/lib/db.ts` lines 44-56)
```typescript
describe('getGraffitiForWall', () => {
  it('should fade scribbles from 1.0 to 0.3 over lifespan', () => {
    // Mock graffiti 50% through lifespan
    // Expect opacity ~0.65
  });

  it('should never fade carved implements', () => {
    // Mock carved graffiti at any age
    // Expect opacity === 1.0
  });

  it('should exclude expired graffiti', () => {
    // Mock graffiti with expires_at in past
    // Expect empty array
  });
});
```

**Why test this:**
- Core business logic (determines user experience)
- Pure calculation (easy to test)
- High risk if wrong (graffiti disappears too fast/slow)

**2. Velocity Gating for Carved Implement** (`/components/DrawingMode.tsx` lines 149-162)
```typescript
describe('carved velocity check', () => {
  it('should reject points when moving too fast', () => {
    const points = simulateFastDrawing();
    expect(points.length).toBeLessThan(expectedFullStroke);
  });

  it('should accept points when moving slowly', () => {
    const points = simulateSlowDrawing();
    expect(points.length).toEqual(expectedFullStroke);
  });
});
```

**Why test this:**
- Unique game mechanic (carved mode feels different)
- Velocity threshold is tunable (tests prevent regressions when tweaking)
- User-facing behavior (broken = bad UX)

**3. Session Timeout Logic** (`/lib/session.ts`)
```typescript
describe('session management', () => {
  it('should reset session after 2 minutes inactivity', () => {
    const firstId = getSessionId();
    // Advance time by 3 minutes
    const secondId = getSessionId();
    expect(firstId).not.toEqual(secondId);
    expect(hasPostedThisSession()).toBe(false);
  });

  it('should preserve session if activity within 2 minutes', () => {
    const firstId = getSessionId();
    // Advance time by 1 minute, then record activity
    recordActivity();
    // Advance time by 1 more minute
    const secondId = getSessionId();
    expect(firstId).toEqual(secondId);
  });
});
```

**Why test this:**
- Critical business rule (one post per session)
- Time-based logic is easy to get wrong
- No UI mocking needed (pure functions)

#### MEDIUM VALUE TESTS (Consider These)

**4. Stroke Coordinate Normalization**
Test that strokes are properly normalized to 0-1 range before saving.

**5. API Validation**
Test that invalid wall/implement types are rejected.

### TESTS TO AVOID

**DON'T TEST:**
- Three.js rendering (you'd be testing the library, not your code)
- Canvas drawing (visual output, hard to test meaningfully)
- Touch gesture recognition (too brittle, needs integration testing)
- Debug controls (not production code)
- Component rendering (React Testing Library would be overkill here)

### TESTING BLOCKERS (Fix These First)

**Blocker 1: Graffiti Rendering Logic Not Extractable**
Can't test rendering without importing entire components. Fix by extracting to `/lib/wall-rendering.ts` (see Section 2).

**Blocker 2: Database Functions Use Global `sql` Import**
Can't test DB functions without a real Postgres instance. Consider dependency injection:
```typescript
export async function getGraffitiForWall(wall: WallType, db = sql) {
  // Now you can pass a mock in tests
}
```

**Blocker 3: sessionStorage Not Mockable**
Session tests will fail in Node.js (no window object). Use a wrapper:
```typescript
// /lib/storage.ts
export const storage = {
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, val) => sessionStorage.setItem(key, val),
};

// In tests, swap for mock
```

---

## 6. Performance & Scalability Concerns

### CURRENT BOTTLENECKS

#### 1. Texture Regeneration on Every Graffiti Change
**Location:** `StallView3D.tsx` lines 264-277

Every time graffiti changes (including every 10s polling), you regenerate THREE complete canvas textures (512×512 each).

**What happens when this scales:**
- 100 pieces of graffiti on a wall = 100 strokes to redraw every 10 seconds
- On mobile devices, this could cause frame drops
- Battery drain from constant canvas operations

**Recommended optimization:**
Only regenerate textures when graffiti for that specific wall changes:
```typescript
const frontTexture = useMemo(
  () => createWallTexture(graffiti.front, 512, 512, true),
  [graffiti.front] // Only recompute if front wall changes
);
```

**You already have this!** But if you add more walls or features, this pattern must continue.

#### 2. No Request Deduplication
**Location:** `StallView3D.tsx` lines 334-358

You fetch all three walls in parallel every 10 seconds. Good! But there's no deduplication if user triggers manual refresh during automatic polling.

**What happens when this scales:**
- User switches walls rapidly → triggers fetchGraffiti 5 times in 2 seconds
- All 5 requests fire in parallel
- Database gets 15 concurrent queries (5 batches × 3 walls)

**Recommended fix:**
Add request cancellation:
```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const fetchGraffiti = useCallback(async () => {
  abortControllerRef.current?.abort();
  const controller = new AbortController();
  abortControllerRef.current = controller;

  const res = await fetch(`/api/graffiti?wall=${wall}`, {
    signal: controller.signal
  });
  // ...
}, []);
```

#### 3. Polling Continues While Drawing
**Location:** Both `StallView3D.tsx` and drawing mode active

When user enters drawing mode, the background polling still runs every 10 seconds, fetching and regenerating textures they can't see.

**What happens:**
- Battery drain
- Wasted bandwidth
- Potential race condition if user submits while poll completes

**Recommended fix:**
Pause polling when in drawing mode:
```typescript
useEffect(() => {
  if (mode === 'drawing') {
    clearInterval(intervalRef.current);
  } else {
    intervalRef.current = setInterval(fetchGraffiti, 10000);
  }
}, [mode]);
```

#### 4. Database Query Gets All Expired Graffiti
**Location:** `/lib/db.ts` line 29

Query is `WHERE expires_at > NOW()`, which is correct. But the index is on `expires_at`, so the database has to scan ALL graffiti (including expired) to apply the wall filter.

**Better index:**
```sql
CREATE INDEX idx_graffiti_wall_expires ON graffiti(wall, expires_at);
```

This lets Postgres filter by wall FIRST, then by expiry. Much faster when you have 10,000+ rows.

### NO CONCERNS (Things You Did Right)

1. **Normalized coordinates** - Strokes stored as 0-1 ratios scale perfectly
2. **Stateless API** - No server-side session state means horizontal scaling works
3. **Optimistic UI updates** - `addLocalGraffiti` shows user's graffiti instantly
4. **Parallel fetching** - Fetching all 3 walls in parallel is good
5. **Canvas texture caching** - Using `useMemo` prevents unnecessary recomputation

---

## 7. Missing Critical Features (From Plan)

Comparing against `PLAN.md`:

### IMPLEMENTED
- ✅ Three walls in 3D
- ✅ Scribble + marker + carved implements
- ✅ One post per session
- ✅ Graffiti decay/opacity fade
- ✅ Session management (2-min timeout)
- ✅ Drawing mode with touch/mouse support
- ✅ API routes for GET/POST graffiti
- ✅ Database schema

### MISSING
- ❌ Cron job for cleanup (critical - see Section 4.4)
- ❌ PWA manifest icons (low priority)
- ❌ Service worker for offline shell (nice-to-have)
- ❌ Visible decay animation (graffiti fades in real-time, not just on refresh)

### SCOPE CREEP (Not in Plan)
- ❌ Debug controls (good for dev, should be dev-only)
- ❌ Floor and ceiling rendering (plan said "v2 idea")
- ❌ Overhead lighting overlay (StallView.tsx line 164)

**Recommendation:**
Focus on completing the planned features (especially cron job) before adding more "nice-to-haves."

---

## 8. Security & Data Validation Concerns

### CURRENT STATE

**Good:**
- Input validation on wall/implement types
- JSONB validation for stroke data
- No user authentication (can't be hacked)
- No XSS risk (canvas rendering, not DOM injection)

### POTENTIAL ISSUES

#### 1. No Rate Limiting
**Location:** `/app/api/graffiti/route.ts`

Anyone can POST unlimited graffiti. A malicious user could:
- Fill database with millions of rows
- Create graffiti with 10,000 strokes (giant file size)
- Spam API with requests to cause database load

**Recommended mitigation:**
```typescript
// Add to POST handler
if (strokeData.length > 100) {
  return NextResponse.json(
    { error: 'Too many strokes. Maximum 100 strokes per graffiti.' },
    { status: 400 }
  );
}

// Each stroke should have reasonable point count
strokeData.forEach(stroke => {
  if (stroke.length > 500) {
    return NextResponse.json(
      { error: 'Stroke too long. Maximum 500 points per stroke.' },
      { status: 400 }
    );
  }
});
```

**Better solution:**
Use Vercel's built-in rate limiting or Upstash Redis for IP-based rate limits.

#### 2. No Validation of Coordinate Bounds
**Location:** API POST handler

A malicious user could send:
```json
{
  "strokeData": [[{"x": 9999, "y": -5000}]]
}
```

This would render off-canvas (harmless) but waste storage and processing.

**Recommended validation:**
```typescript
strokeData.forEach(stroke => {
  stroke.forEach(point => {
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      throw new Error('Coordinates must be 0-1');
    }
  });
});
```

#### 3. SQL Injection Risk: LOW but Check
**Location:** `/lib/db.ts`

You're using Vercel Postgres with parameterized queries (`${wall}`), which prevents SQL injection. Good!

**Verify this works correctly:**
```typescript
// Make sure this doesn't allow injection:
await sql`SELECT * FROM graffiti WHERE wall = ${userInput}`;
```

The `sql` template tag should escape properly, but add a test case to be sure.

---

## Final Recommendations: Priority Order

### CRITICAL (Do This Week)

1. ~~**Delete `StallView.tsx`**~~ ✅ COMPLETED - Removed 373 lines of dead code
2. ~~**Implement cron job**~~ ✅ COMPLETED - Added `/api/cron/cleanup/route.ts` and `/vercel.json`
3. ~~**Extract graffiti rendering logic**~~ ✅ COMPLETED - Created `/lib/wall-rendering.ts` with renderGraffitiStrokes() and calculateOpacity()
4. ~~**Add rate limiting**~~ ✅ COMPLETED - Added IP-based rate limiting (5 posts/hour) via `/lib/rate-limit.ts`

**Status:** All 4 critical items completed.

### HIGH PRIORITY (Do This Month)

5. ~~**Move opacity calculation to client**~~ ✅ COMPLETED - Opacity now calculated client-side, enables real-time fading
6. ~~**Add error boundaries**~~ ✅ COMPLETED - ErrorBoundary.tsx wraps StallView3D, handles WebGL failures
7. ~~**Add loading states**~~ ✅ COMPLETED - Loading indicator during initial graffiti fetch
8. ~~**Fix coordinate bounds validation**~~ ✅ COMPLETED - API validates: coordinates (0-1), max 100 strokes, max 500 points/stroke

**Status:** All 4 high-priority items completed.

### MEDIUM PRIORITY (Do Next Quarter)

9. **Extract texture generation functions** - Improve testability/reusability
10. **Write core logic tests** - Opacity calc, velocity gating, session timeout
11. **Optimize polling** - Pause during drawing mode, add request deduplication
12. **Document coordinate systems** - Prevent confusion for future developers

**Business impact:** Technical debt prevention, easier to add features.

### LOW PRIORITY (Nice to Have)

13. **Create debug mode toggle** - Extract to separate component
14. **Add PWA icons** - Complete PWA implementation
15. **Normalize timestamp handling** - Use numbers instead of strings
16. **Improve naming consistency** - Pick "stall" vs "room" and stick with it

**Business impact:** Polish, minor improvements.

---

## Conclusion

**Overall Assessment:** This is a solid codebase with good fundamentals. The migration to Three.js was the right call. However, you're sitting on 40% dead code (StallView.tsx + Wall.tsx) and missing a critical piece (cron cleanup job).

**Biggest Risk:** Database will fill with expired graffiti within 2-3 months. Add the cron job NOW.

**Biggest Opportunity:** Extract rendering logic to `/lib/wall-rendering.ts` and you'll have a highly testable, reusable rendering pipeline.

**When to Refactor:** You don't need state management yet. Wait until you add 2-3 more features (undo, favorites, etc.), THEN consider Zustand/Jotai.

**Tech Debt Grade:** B-
(Would be A- without the dead code and missing cron job)

**Maintainability Forecast:**
- Next 3 months: Easy to maintain (small codebase, clear structure)
- 6-12 months: Will need refactoring when you add user accounts, moderation, or social features
- 1+ year: Will need state management and probably backend restructuring

**Ship Readiness:**
- Can ship to production TODAY if you add the cron job
- Strongly recommend removing dead code first (reduces confusion)
- Add error boundaries for production robustness

---

## Appendix: File Inventory

**Total Files:** 13 source files (excluding node_modules, .next)

### Active Production Code (In Use)
1. `/app/page.tsx` - Main entry point
2. `/app/layout.tsx` - Root layout
3. `/components/StallView3D.tsx` - Three.js 3D view (ACTIVE)
4. `/components/DrawingMode.tsx` - Drawing interface
5. `/components/ImplementPicker.tsx` - Implement selector
6. `/lib/config.ts` - Constants and types
7. `/lib/session.ts` - Session management
8. `/lib/db.ts` - Database queries
9. `/app/api/graffiti/route.ts` - GET/POST graffiti
10. `/app/api/init/route.ts` - DB initialization

### Dead Code (Deleted)
~~11. `/components/StallView.tsx`~~ - CSS 3D version ✅ DELETED
~~12. `/components/Wall.tsx`~~ - Used only by dead StallView.tsx ✅ DELETED

### Config/Styles
13. `/app/globals.css` - Global styles

**Lines of Code:**
- Active production code: ~1,200 lines
- ~~Dead code: ~525 lines (40% waste)~~ ✅ DELETED
- Total: ~1,200 lines (post-cleanup)

**After cleanup:**
- Production code: ~1,200 lines (tighter, clearer)
- New code added: ~80 lines (rate-limit.ts, cron route, vercel.json)

---

**End of Audit**
