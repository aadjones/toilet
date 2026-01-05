'use client';

import { useEffect, useRef } from 'react';
import { type Graffiti, IMPLEMENT_STYLES, type ImplementType } from '@/lib/config';

interface WallProps {
  graffiti: Graffiti[];
  showLock?: boolean;
}

export function Wall({ graffiti, showLock = false }: WallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw each graffiti
    graffiti.forEach((g) => {
      const style = IMPLEMENT_STYLES[g.implement as ImplementType];

      ctx.strokeStyle = g.color;
      ctx.lineWidth = style.lineWidth;
      ctx.lineCap = style.lineCap;
      ctx.lineJoin = style.lineJoin;
      ctx.globalAlpha = g.opacity;

      // Add wobble for scribble, jaggedness for carved
      if (g.implement === 'carved') {
        ctx.setLineDash([2, 1]);
      } else {
        ctx.setLineDash([]);
      }

      g.strokeData.forEach((stroke) => {
        if (stroke.length < 2) return;

        ctx.beginPath();
        const startX = stroke[0].x * rect.width;
        const startY = stroke[0].y * rect.height;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < stroke.length; i++) {
          const x = stroke[i].x * rect.width;
          const y = stroke[i].y * rect.height;

          // Add slight wobble for scribble
          if (g.implement === 'scribble') {
            const wobble = (Math.random() - 0.5) * 1;
            ctx.lineTo(x + wobble, y + wobble);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      });
    });

    // Reset alpha
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }, [graffiti]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        background: 'linear-gradient(135deg, #e8dfd0 0%, #dfd6c7 50%, #d8cfc0 100%)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), inset 0 -1px 3px rgba(0,0,0,0.1)',
      }}
    >
      {/* Subtle wear/imperfection texture - realistic */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.02) 2px,
            rgba(0,0,0,0.02) 4px
          ),
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.01) 3px,
            rgba(0,0,0,0.01) 6px
          )`,
        }}
      />

      {/* Stall door lock - RIGHT SIDE, PROPER HEIGHT (55% from top) */}
      {showLock && (
        <div className="absolute right-6 top-[55%] -translate-y-1/2 z-10">
          {/* Lock housing - more compact */}
          <div
            className="relative bg-gradient-to-b from-[#d0d0d0] to-[#b8b8b8] rounded border border-[#888] shadow-md"
            style={{ width: '65px', height: '32px' }}
          >
            {/* Occupied/vacant indicator - red for occupied */}
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-[#666]"
              style={{
                background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            />
            {/* Bolt mechanism on right */}
            <div
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#808080] rounded"
              style={{ width: '20px', height: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            />
          </div>
          {/* Mounting bracket visual */}
          <div
            className="absolute left-0 right-0 -bottom-2 h-1"
            style={{
              background: 'linear-gradient(to right, transparent, #a89888 10%, #a89888 90%, transparent)',
            }}
          />
        </div>
      )}

      {/* Canvas for graffiti */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
