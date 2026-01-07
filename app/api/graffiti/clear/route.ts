import { NextResponse } from 'next/server';
import { deleteAllGraffiti } from '@/lib/db';

// POST /api/graffiti/clear
export async function POST() {
  try {
    const deletedCount = await deleteAllGraffiti();
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Failed to clear graffiti:', error);
    return NextResponse.json(
      { error: 'Failed to clear graffiti' },
      { status: 500 }
    );
  }
}
