import { NextRequest, NextResponse } from 'next/server';
import { getGraffitiForWall, createGraffiti } from '@/lib/db';
import { IMPLEMENT_STYLES, type WallType, type ImplementType, type Stroke } from '@/lib/config';

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
    return NextResponse.json({ graffiti });
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
    if (!implement || !['scribble', 'marker', 'carved'].includes(implement)) {
      return NextResponse.json(
        { error: 'Invalid implement. Must be scribble, marker, or carved.' },
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

    // Get color from implement style
    const color = IMPLEMENT_STYLES[implement].color;

    const id = await createGraffiti(wall, implement, strokeData, color);

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error('Failed to create graffiti:', error);
    return NextResponse.json(
      { error: 'Failed to create graffiti' },
      { status: 500 }
    );
  }
}
