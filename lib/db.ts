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

  // Create analytics table
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create indexes for analytics
  await sql`
    CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id)
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

// Delete specific graffiti by ID
export async function deleteGraffitiById(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM graffiti
    WHERE id = ${id}
  `;

  return (result.rowCount ?? 0) > 0;
}

// Delete all graffiti (for admin/debug purposes)
export async function deleteAllGraffiti(): Promise<number> {
  const result = await sql`
    DELETE FROM graffiti
  `;

  return result.rowCount ?? 0;
}

// Analytics functions

export async function trackEvent(
  sessionId: string,
  eventType: string,
  metadata?: Record<string, any>
): Promise<void> {
  await sql`
    INSERT INTO analytics_events (session_id, event_type, metadata)
    VALUES (${sessionId}, ${eventType}, ${metadata ? JSON.stringify(metadata) : null})
  `;
}

export async function getAnalyticsStats() {
  try {
    // Total sessions (unique session IDs)
    const sessionsResult = await sql`
      SELECT COUNT(DISTINCT session_id) as total
      FROM analytics_events
    `;

    // Wall rotations
    const rotationsResult = await sql`
      SELECT
        COUNT(*) as total,
        metadata->>'from' as from_wall,
        metadata->>'to' as to_wall
      FROM analytics_events
      WHERE event_type = 'wall_rotation'
      GROUP BY metadata->>'from', metadata->>'to'
    `;

    // Implement selections
    const implementsResult = await sql`
      SELECT
        metadata->>'implement' as implement,
        COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'implement_selected'
      GROUP BY metadata->>'implement'
      ORDER BY count DESC
    `;

    // Drawings submitted
    const drawingsResult = await sql`
      SELECT
        metadata->>'wall' as wall,
        metadata->>'implement' as implement,
        COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'drawing_submitted'
      GROUP BY metadata->>'wall', metadata->>'implement'
    `;

    // Session starts by time (last 7 days, by hour)
    const timelineResult = await sql`
      SELECT
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'session_start'
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
      LIMIT 168
    `;

    return {
      totalSessions: sessionsResult.rows[0]?.total || 0,
      rotations: rotationsResult.rows || [],
      implements: implementsResult.rows || [],
      drawings: drawingsResult.rows || [],
      timeline: timelineResult.rows || [],
    };
  } catch (error) {
    console.error('Error fetching analytics stats:', error);
    // Return empty stats if table doesn't exist or query fails
    return {
      totalSessions: 0,
      rotations: [],
      implements: [],
      drawings: [],
      timeline: [],
    };
  }
}
