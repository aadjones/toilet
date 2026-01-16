import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';
import { getGraffitiForWall, createGraffiti } from '@/lib/db';
import { IMPLEMENT_STYLES, type WallType, type ImplementType, type Stroke, DECAY_DURATIONS } from '@/lib/config';
import { checkRateLimit } from '@/lib/rate-limit';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

// GET /api/graffiti?wall=front
export async function GET(request: NextRequest) {
  const wall = request.nextUrl.searchParams.get('wall') as WallType;

  if (!wall || !['front', 'left', 'right'].includes(wall)) {
    return NextResponse.json(
      { error: 'Invalid wall parameter. Must be front, left, or right.' },
      { status: 400 }
    );
  }

  try {
    const graffiti = await getGraffitiForWall(wall);

    // No CDN caching - users need to see graffiti updates immediately
    // The database can handle the load with proper indexing on (wall, expires_at)
    return NextResponse.json(
      { graffiti },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch graffiti:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graffiti' },
      { status: 500 }
    );
  }
}

// POST /api/graffiti
export async function POST(request: NextRequest) {
  // Rate limit by IP address: 5 posts per hour (if enabled)
  if (FEATURE_FLAGS.ENABLE_RATE_LIMITING) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const rateLimit = checkRateLimit(ip, 5, 60 * 60 * 1000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        }
      );
    }
  }

  try {
    const body = await request.json();
    const { wall, implement, strokeData } = body as {
      wall: WallType;
      implement: ImplementType;
      strokeData: Stroke[];
    };

    // Validate wall
    if (!wall || !['front', 'left', 'right'].includes(wall)) {
      return NextResponse.json(
        { error: 'Invalid wall. Must be front, left, or right.' },
        { status: 400 }
      );
    }

    // Validate implement
    if (!implement || !['scribble', 'marker', 'carved', 'whiteout'].includes(implement)) {
      return NextResponse.json(
        { error: 'Invalid implement. Must be scribble, marker, carved, or whiteout.' },
        { status: 400 }
      );
    }

    // Validate strokeData
    if (!strokeData || !Array.isArray(strokeData) || strokeData.length === 0) {
      return NextResponse.json(
        { error: 'strokeData must be a non-empty array of strokes.' },
        { status: 400 }
      );
    }

    // Validate stroke count (prevent abuse)
    if (strokeData.length > 100) {
      return NextResponse.json(
        { error: 'Too many strokes. Maximum 100 strokes per graffiti.' },
        { status: 400 }
      );
    }

    // Validate coordinate bounds and point counts
    for (const stroke of strokeData) {
      if (!Array.isArray(stroke) || stroke.length === 0) {
        return NextResponse.json(
          { error: 'Each stroke must be a non-empty array of points.' },
          { status: 400 }
        );
      }

      if (stroke.length > 500) {
        return NextResponse.json(
          { error: 'Stroke too long. Maximum 500 points per stroke.' },
          { status: 400 }
        );
      }

      for (const point of stroke) {
        if (
          typeof point.x !== 'number' ||
          typeof point.y !== 'number' ||
          point.x < 0 ||
          point.x > 1 ||
          point.y < 0 ||
          point.y > 1
        ) {
          return NextResponse.json(
            { error: 'All coordinates must be numbers between 0 and 1.' },
            { status: 400 }
          );
        }
      }
    }

    // Get color from implement style
    const color = IMPLEMENT_STYLES[implement].color;

    const id = await createGraffiti(wall, implement, strokeData, color);

    // Broadcast new graffiti to all connected clients via Ably
    try {
      const ably = new Ably.Rest(process.env.ABLY_API_KEY!);
      const channel = ably.channels.get('graffiti-wall');

      const now = new Date();
      const expiresAt = new Date(now.getTime() + DECAY_DURATIONS[implement]);

      await channel.publish('new-graffiti', {
        id,
        wall,
        implement,
        strokeData,
        color,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        opacity: 1,
      });
    } catch (error) {
      console.error('Failed to broadcast via Ably:', error);
      // Don't fail the request if Ably fails - graffiti is still saved to DB
    }

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error('Failed to create graffiti:', error);
    return NextResponse.json(
      { error: 'Failed to create graffiti' },
      { status: 500 }
    );
  }
}
