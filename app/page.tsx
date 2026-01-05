'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StallView } from '@/components/StallView';
import { DrawingMode } from '@/components/DrawingMode';
import {
  getSessionId,
  recordActivity,
  hasPostedThisSession,
  markAsPosted,
} from '@/lib/session';
import { type WallType, type ImplementType, type Stroke, type Graffiti, IMPLEMENT_STYLES } from '@/lib/config';

type Mode = 'viewing' | 'drawing' | 'already-posted';

export default function Home() {
  const [mode, setMode] = useState<Mode>('viewing');
  const [activeWall, setActiveWall] = useState<WallType>('front');
  const [message, setMessage] = useState<string | null>(null);
  const stallRef = useRef<{ addLocalGraffiti: (wall: WallType, graffiti: Graffiti) => void } | null>(null);

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

  const handleWriteRequest = useCallback((wall: WallType) => {
    if (hasPostedThisSession()) {
      setMessage('You already left your mark.');
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    setActiveWall(wall);
    setMode('drawing');
  }, []);

  const handleSubmit = useCallback(async (strokeData: Stroke[], implement: ImplementType) => {
    try {
      const response = await fetch('/api/graffiti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wall: activeWall,
          implement,
          strokeData,
        }),
      });

      if (response.ok) {
        // Parse response to get the created graffiti with ID
        const data = await response.json();
        const newGraffiti: Graffiti = {
          id: data.id,
          wall: activeWall,
          implement,
          strokeData,
          color: IMPLEMENT_STYLES[implement].color,
          opacity: 1,
          createdAt: new Date().toISOString(),
        };

        // Render graffiti instantly
        stallRef.current?.addLocalGraffiti(activeWall, newGraffiti);

        markAsPosted();
        setMode('viewing');
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
  }, [activeWall]);

  const handleCancel = useCallback(() => {
    setMode('viewing');
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden select-none">
      <StallView stallRef={stallRef} onWriteRequest={handleWriteRequest} />

      {mode === 'drawing' && (
        <DrawingMode
          wall={activeWall}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {/* Toast message */}
      {message && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-6 py-3 bg-[#333] text-[#ccc] text-sm rounded shadow-lg">
          {message}
        </div>
      )}
    </main>
  );
}
