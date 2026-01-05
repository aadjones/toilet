import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/db';

// GET /api/init - Initialize the database schema
// Only call this once when setting up the project
export async function GET() {
  try {
    await initializeDatabase();
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database', details: String(error) },
      { status: 500 }
    );
  }
}
