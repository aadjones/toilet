import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Test database connection
    const result = await sql`SELECT NOW() as current_time`;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      time: result.rows[0].current_time,
      env_check: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      env_check: {
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      }
    }, { status: 500 });
  }
}
