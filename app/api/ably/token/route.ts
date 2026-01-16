import { NextResponse } from 'next/server';
import Ably from 'ably';

// Token authentication endpoint for Ably client connections
// This is more secure than exposing the API key directly to clients
export async function GET() {
  try {
    const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

    // Request a token that's valid for 1 hour
    const tokenRequest = await ably.auth.createTokenRequest({
      capability: {
        'graffiti-wall': ['subscribe', 'history'], // Read-only access for clients
      },
      ttl: 60 * 60 * 1000, // 1 hour
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('Failed to create Ably token:', error);
    return NextResponse.json(
      { error: 'Failed to create auth token' },
      { status: 500 }
    );
  }
}
