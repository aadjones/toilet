# Bathroom Stall Graffiti

A 3D interactive bathroom stall where users can leave temporary graffiti marks using different implements.

## Features

- **3D Environment**: Realistic bathroom stall with perspective-correct drawing
- **Multiple Implements**:
  - Sharpie (permanent marker)
  - Scribble (crayon-like)
  - Carved (etched appearance)
- **Temporal Graffiti**: Messages fade over time (except carved ones)
- **Three Walls**: Draw on the front door and side walls
- **Session Limits**: One mark per session to prevent spam
- **Instant Rendering**: What you draw is what you see - no delays

## Tech Stack

- **Next.js 15** with App Router
- **React Three Fiber** for 3D rendering
- **Three.js** for perspective calculations
- **SQLite** (via better-sqlite3) for persistent storage
- **TypeScript** for type safety

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the stall.

## How It Works

### Coordinate System

The app uses perspective-correct coordinate mapping to ensure graffiti appears exactly where you draw it:

1. **3D Projection**: Projects wall corners from 3D world space to 2D screen space
2. **Bounding Box**: Calculates the exact pixel bounds where each wall appears on screen
3. **Normalized Coordinates**: Stores coordinates (0-1) relative to wall bounds, not viewport
4. **Texture Mapping**: Renders graffiti to textures that match the wall aspect ratios

This ensures the preview and final rendering are pixel-perfect matches.

### Temporal Decay

- **Sharpie**: Fades from 100% to 30% opacity over 24 hours
- **Scribble**: Fades from 100% to 30% opacity over 12 hours
- **Carved**: Never fades (permanent)

Expired graffiti is automatically cleaned up from the database.

## Database Schema

```sql
CREATE TABLE graffiti (
  id TEXT PRIMARY KEY,
  wall TEXT NOT NULL,
  implement TEXT NOT NULL,
  strokeData TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm run clean` - Clean build artifacts and database

## License

MIT
