import { sql } from '@vercel/postgres';
import { DECAY_DURATIONS, type WallType, type ImplementType, type Stroke, type Graffiti } from './config';

// Initialize the database schema
export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS graffiti (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wall TEXT NOT NULL,
      implement TEXT NOT NULL,
      stroke_data JSONB NOT NULL,
      color TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  // Create indexes if they don't exist
  await sql`
    CREATE INDEX IF NOT EXISTS idx_graffiti_wall ON graffiti(wall)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_graffiti_expires ON graffiti(expires_at)
  `;
}

// Get all non-expired graffiti for a wall, with calculated opacity
export async function getGraffitiForWall(wall: WallType): Promise<Graffiti[]> {
  const result = await sql`
    SELECT
      id,
      wall,
      implement,
      stroke_data,
      color,
      created_at,
      expires_at
    FROM graffiti
    WHERE wall = ${wall}
      AND expires_at > NOW()
    ORDER BY created_at ASC
  `;

  const now = Date.now();

  return result.rows.map(row => {
    const createdAt = new Date(row.created_at).getTime();
    const expiresAt = new Date(row.expires_at).getTime();
    const lifespan = expiresAt - createdAt;
    const age = now - createdAt;
    const progress = Math.min(age / lifespan, 1);

    // Carved doesn't fade, others fade from 1.0 to 0.3
    const opacity = row.implement === 'carved'
      ? 1.0
      : 1.0 - (progress * 0.7);

    return {
      id: row.id,
      wall: row.wall as WallType,
      implement: row.implement as ImplementType,
      strokeData: row.stroke_data as Stroke[],
      color: row.color,
      createdAt: row.created_at,
      opacity,
    };
  });
}

// Create new graffiti
export async function createGraffiti(
  wall: WallType,
  implement: ImplementType,
  strokeData: Stroke[],
  color: string
): Promise<string> {
  const durationMs = DECAY_DURATIONS[implement];
  const expiresAt = new Date(Date.now() + durationMs);

  const result = await sql`
    INSERT INTO graffiti (wall, implement, stroke_data, color, expires_at)
    VALUES (${wall}, ${implement}, ${JSON.stringify(strokeData)}, ${color}, ${expiresAt.toISOString()})
    RETURNING id
  `;

  return result.rows[0].id;
}

// Clean up expired graffiti
export async function cleanupExpiredGraffiti(): Promise<number> {
  const result = await sql`
    DELETE FROM graffiti
    WHERE expires_at < NOW()
  `;

  return result.rowCount ?? 0;
}
