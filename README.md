# Bathroom Stall Graffiti

A 3D interactive bathroom stall where users can leave temporary graffiti marks using different implements. Real-time collaboration with instant updates across all connected users.

## Features

- **3D Environment**: CSS 3D transforms for a realistic bathroom stall with perspective viewing
- **Multiple Implements**:
  - Marker (black, thick permanent marker)
  - Scribble (gray, thin pencil-like)
  - Carved (etched appearance, slow drawing required)
  - Whiteout (white correction fluid)
- **Real-time Collaboration**: Instant graffiti updates via WebSockets - see other users' marks appear live
- **Temporal Graffiti**: Messages fade and expire over time
- **Three Walls**: Draw on the front door and side walls
- **Session Limits**: One mark per session to prevent spam
- **No Login Required**: Anonymous, ephemeral experience

## Tech Stack

- **Next.js 16** with App Router and Turbopack
- **CSS 3D Transforms** for lightweight 3D perspective (no WebGL/Three.js)
- **HTML Canvas API** for drawing and rendering graffiti
- **Neon Postgres** for persistent storage (serverless)
- **Ably** for real-time pub/sub messaging (WebSockets)
- **TypeScript** for type safety
- **Tailwind CSS** for styling

## Getting Started

### Prerequisites

You'll need:
- Node.js 18+ and npm
- A Neon Postgres database (free tier: [neon.tech](https://neon.tech))
- An Ably account for real-time updates (free tier: [ably.com](https://ably.com))

### Environment Setup

Create a `.env.local` file in the project root:

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ABLY_API_KEY=your_ably_api_key_here
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the stall.

## How It Works

### Real-Time Architecture

The app uses WebSockets (via Ably) for instant graffiti updates:

1. **On page load**: Your browser opens a WebSocket connection to Ably and subscribes to the "graffiti-wall" channel
2. **When you draw**: The graffiti is saved to Postgres and broadcast to all connected users via Ably
3. **Instant updates**: Everyone sees new graffiti appear within ~100ms, no polling required
4. **Security**: Clients get read-only access via token auth - only the server can broadcast new graffiti

This is the same architecture used by collaborative whiteboard apps like Figma and Miro.

### 3D Rendering

Uses CSS 3D transforms instead of WebGL/Three.js:
- Three wall surfaces positioned in 3D space with `transform: translateZ()` and `rotateY()`
- User can swipe left/right to rotate the room and view different walls
- Graffiti rendered to 2D canvases, which are then mapped to 3D wall surfaces
- Normalized coordinates (0-1) ensure graffiti appears in the correct position regardless of screen size

### Temporal Decay

Each implement has different lifespan and fade behavior:
- **Marker**: Fades over 24 hours, then expires
- **Scribble**: Fades over 4 hours, then expires
- **Carved**: Visible for 1 week (no fade), then expires
- **Whiteout**: Fades over 2 hours, then expires

A Vercel cron job runs hourly to delete expired graffiti from the database.

## Database Schema

```sql
CREATE TABLE graffiti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall TEXT NOT NULL,              -- 'front' | 'left' | 'right'
  implement TEXT NOT NULL,         -- 'scribble' | 'marker' | 'carved' | 'whiteout'
  stroke_data JSONB NOT NULL,      -- array of strokes
  color TEXT NOT NULL,             -- hex color
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_graffiti_wall_expires ON graffiti(wall, expires_at);
```

## Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production (always run before committing!)
- `npm run lint` - Run ESLint

## Deployment

Deployed on Vercel with:
- Neon Postgres for database
- Ably for real-time messaging
- Vercel Cron for cleanup job
- Environment variables configured in Vercel dashboard

## License

MIT
