import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsStats } from '@/lib/db';

// GET /api/admin/stats
export async function GET(request: NextRequest) {
  // Simple password protection via header
  const auth = request.headers.get('authorization');
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (auth !== `Bearer ${adminPassword}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const stats = await getAnalyticsStats();

    // Cache analytics for 2 minutes - reduces bandwidth for dashboard refreshes
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'private, s-maxage=120, stale-while-revalidate=240',
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
