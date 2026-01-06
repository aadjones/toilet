'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StallView3D } from '@/components/StallView3D';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  getSessionId,
  recordActivity,
  hasPostedThisSession,
  markAsPosted,
} from '@/lib/session';
import { type WallType, type ImplementType, type Stroke, type Graffiti, IMPLEMENT_STYLES, DECAY_DURATIONS } from '@/lib/config';

export default function Home() {
  const [message, setMessage] = useState<string | null>(null);
  const stallRef = useRef<{
    addLocalGraffiti: (wall: WallType, graffiti: Graffiti) => void;
    getWallGraffiti: (wall: WallType) => Graffiti[];
  } | null>(null);

  // Initialize session on mount
  useEffect(() => {
    getSessionId();
  }, []);

  // Record activity on any interaction
  useEffect(() => {
    const handleInteraction = () => recordActivity();

    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('click', handleInteraction);

    return () => {
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, []);

  const handleSubmit = useCallback(async (wall: WallType, strokeData: Stroke[], implement: ImplementType) => {
    if (hasPostedThisSession()) {
      setMessage('You already left your mark.');
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    try {
      const response = await fetch('/api/graffiti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wall,
          implement,
          strokeData,
        }),
      });

      if (response.ok) {
        // Parse response to get the created graffiti with ID
        const data = await response.json();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DECAY_DURATIONS[implement]);

        const newGraffiti: Graffiti = {
          id: data.id,
          wall,
          implement,
          strokeData,
          color: IMPLEMENT_STYLES[implement].color,
          opacity: 1,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        };

        // Render graffiti instantly
        stallRef.current?.addLocalGraffiti(wall, newGraffiti);

        markAsPosted();
        setMessage('Marked.');
        setTimeout(() => setMessage(null), 1500);
      } else {
        console.error('Failed to submit graffiti');
        setMessage('Something went wrong.');
        setTimeout(() => setMessage(null), 2000);
      }
    } catch (error) {
      console.error('Failed to submit graffiti:', error);
      setMessage('Something went wrong.');
      setTimeout(() => setMessage(null), 2000);
    }
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden select-none bg-black flex items-center justify-center">
      <ErrorBoundary>
        {/* Constrain to mobile aspect ratio even on desktop */}
        <div className="w-full h-full max-w-[480px] relative">
          <StallView3D stallRef={stallRef} onSubmit={handleSubmit} />
        </div>
      </ErrorBoundary>

      {/* Toast message */}
      {message && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-6 py-3 bg-[#333] text-[#ccc] text-sm rounded shadow-lg">
          {message}
        </div>
      )}
    </main>
  );
}
