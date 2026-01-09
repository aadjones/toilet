import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/db';

// POST /api/analytics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, eventType, metadata } = body;

    if (!sessionId || !eventType) {
      return NextResponse.json(
        { error: 'sessionId and eventType are required' },
        { status: 400 }
      );
    }

    await trackEvent(sessionId, eventType, metadata);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to track analytics event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}
