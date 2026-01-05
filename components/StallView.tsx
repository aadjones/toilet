'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Wall } from './Wall';
import { type Graffiti, type WallType } from '@/lib/config';

interface StallViewProps {
  onWriteRequest: (wall: WallType) => void;
  stallRef?: React.MutableRefObject<any>;
}

type FacingDirection = 'front' | 'left' | 'right';

export function StallView({ onWriteRequest, stallRef }: StallViewProps) {
  const [facing, setFacing] = useState<FacingDirection>('front');
  const [graffiti, setGraffiti] = useState<Record<WallType, Graffiti[]>>({
    front: [],
    left: [],
    right: [],
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch graffiti for all walls
  const fetchGraffiti = useCallback(async () => {
    try {
      const walls: WallType[] = ['front', 'left', 'right'];
      const results = await Promise.all(
        walls.map(async (wall) => {
          const res = await fetch(`/api/graffiti?wall=${wall}`);
          if (!res.ok) return { wall, graffiti: [] };
          const data = await res.json();
          return { wall, graffiti: data.graffiti };
        })
      );

      const newGraffiti: Record<WallType, Graffiti[]> = {
        front: [],
        left: [],
        right: [],
      };
      results.forEach(({ wall, graffiti }) => {
        newGraffiti[wall] = graffiti;
      });
      setGraffiti(newGraffiti);
    } catch (error) {
      console.error('Failed to fetch graffiti:', error);
    }
  }, []);

  // Add graffiti instantly (called from DrawingMode)
  const addLocalGraffiti = useCallback((wall: WallType, newGraffiti: Graffiti) => {
    setGraffiti((prev) => ({
      ...prev,
      [wall]: [...prev[wall], newGraffiti],
    }));
  }, []);

  // Expose addLocalGraffiti via ref
  useEffect(() => {
    if (stallRef) {
      stallRef.current = { addLocalGraffiti };
    }
    if (containerRef.current) {
      (containerRef.current as any).__addGraffiti = addLocalGraffiti;
    }
  }, [addLocalGraffiti, stallRef]);

  // Initial fetch and polling (10s for other users' graffiti)
  useEffect(() => {
    fetchGraffiti();
    const interval = setInterval(fetchGraffiti, 10000);
    return () => clearInterval(interval);
  }, [fetchGraffiti]);

  // Handle swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || isTransitioning) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      rotate(diff > 0 ? 'left' : 'right');
    }

    touchStartX.current = null;
  };

  // Handle mouse drag rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseStartX.current === null || isTransitioning) return;

    const diff = e.clientX - mouseStartX.current;
    const threshold = 20;

    if (Math.abs(diff) > threshold) {
      rotate(diff > 0 ? 'left' : 'right');
      mouseStartX.current = e.clientX;
    }
  };

  const handleMouseUp = () => {
    mouseStartX.current = null;
  };

  const handleMouseLeave = () => {
    mouseStartX.current = null;
  };

  // Rotate camera (inverted for interior perspective)
  const rotate = (direction: 'left' | 'right') => {
    setIsTransitioning(true);
    setFacing((prev) => {
      // Drag RIGHT = turn head right = see RIGHT wall
      if (direction === 'right') {
        if (prev === 'front') return 'right';
        if (prev === 'left') return 'front';
        if (prev === 'right') return 'left';
      } else {
        // Drag LEFT = turn head left = see LEFT wall
        if (prev === 'front') return 'left';
        if (prev === 'right') return 'front';
        if (prev === 'left') return 'right';
      }
      return prev;
    });
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Get rotation based on facing direction (90 degrees, not 45)
  const getRotation = () => {
    switch (facing) {
      case 'left': return 90;
      case 'right': return -90;
      default: return 0;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black cursor-grab active:cursor-grabbing select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: '1000px',
        perspectiveOrigin: 'center 58%',
      }}
    >
      {/* Overhead fluorescent lighting overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(200,210,220,0.15) 0%, transparent 30%)',
          zIndex: 1,
        }}
      />

      {/* 3D room container */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${getRotation()}deg)`,
          transition: isTransitioning ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {/* Floor with tile pattern */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            width: '800px',
            height: '300px',
            background: `
              linear-gradient(45deg, #c8bfb0 25%, transparent 25%, transparent 75%, #c8bfb0 75%, #c8bfb0),
              linear-gradient(45deg, #c8bfb0 25%, transparent 25%, transparent 75%, #c8bfb0 75%, #c8bfb0)
            `,
            backgroundSize: '60px 60px',
            backgroundPosition: '0 0, 30px 30px',
            transform: 'rotateX(90deg) translateZ(-250px)',
            transformOrigin: 'center center',
            borderTop: '1px solid #a89888',
          }}
        />

        {/* Ceiling with light */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{
            width: '800px',
            height: '200px',
            background: 'linear-gradient(to bottom, #b0b0b0, #a0a0a0)',
            transform: 'rotateX(-90deg) translateZ(-350px)',
            transformOrigin: 'center center',
            boxShadow: 'inset 0 -10px 40px rgba(255,255,255,0.3)',
          }}
        >
          {/* Fluorescent light fixture */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '200px',
              height: '40px',
              background: 'linear-gradient(to bottom, #e0e0e0, #d0d0d0)',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.5)',
            }}
          />
        </div>

        {/* Front wall (door) */}
        <div
          className="absolute"
          style={{
            width: '400px',
            height: '600px',
            transform: 'translateZ(-200px)',
            transformStyle: 'preserve-3d',
          }}
        >
          <Wall graffiti={graffiti.front} showLock={true} />
        </div>

        {/* Left wall */}
        <div
          className="absolute"
          style={{
            width: '400px',
            height: '600px',
            transform: 'rotateY(90deg) translateZ(-200px)',
            transformStyle: 'preserve-3d',
          }}
        >
          <Wall graffiti={graffiti.left} />
        </div>

        {/* Right wall */}
        <div
          className="absolute"
          style={{
            width: '400px',
            height: '600px',
            transform: 'rotateY(-90deg) translateZ(-200px)',
            transformStyle: 'preserve-3d',
          }}
        >
          <Wall graffiti={graffiti.right} />
        </div>
      </div>

      {/* Write button - subtle */}
      <button
        onClick={() => onWriteRequest(facing)}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 text-[#999] text-xs font-medium hover:text-[#bbb] transition-colors z-10"
        style={{
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          pointerEvents: 'auto',
        }}
      >
        write
      </button>

      {/* Interaction hint */}
      <div className="absolute top-4 left-4 text-[#666] text-xs z-10 pointer-events-none">
        drag to look
      </div>
    </div>
  );
}
