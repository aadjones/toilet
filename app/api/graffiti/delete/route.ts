import { NextResponse } from 'next/server';
import { deleteGraffitiById } from '@/lib/db';

/**
 * DELETE /api/graffiti/delete
 * Deletes a specific graffiti by ID
 */
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Graffiti ID is required' },
        { status: 400 }
      );
    }

    const success = await deleteGraffitiById(id);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Graffiti not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Failed to delete graffiti:', error);
    return NextResponse.json(
      { error: 'Failed to delete graffiti' },
      { status: 500 }
    );
  }
}
