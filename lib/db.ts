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

// Get all non-expired graffiti for a wall
// Opacity is calculated client-side for real-time fading
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

  return result.rows.map(row => ({
    id: row.id,
    wall: row.wall as WallType,
    implement: row.implement as ImplementType,
    strokeData: row.stroke_data as Stroke[],
    color: row.color,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    opacity: 1, // Calculated client-side via calculateOpacity()
  }));
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
