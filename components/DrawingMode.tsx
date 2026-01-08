'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ImplementPicker } from './ImplementPicker';
import {
  type ImplementType,
  type WallType,
  type Stroke,
  type StrokePoint,
  type Graffiti,
  IMPLEMENT_STYLES,
  CARVE_VELOCITY_THRESHOLD,
} from '@/lib/config';
import { renderGraffitiStrokes } from '@/lib/wall-rendering';

interface DrawingModeProps {
  wall: WallType;
  existingGraffiti: Graffiti[];
  onSubmit: (strokeData: Stroke[], implement: ImplementType) => void;
  onCancel: () => void;
}

export function DrawingMode({ wall, existingGraffiti, onSubmit, onCancel }: DrawingModeProps) {
  const [implement, setImplement] = useState<ImplementType>('scribble');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isImplementLocked, setIsImplementLocked] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Set up canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // Redraw canvas when strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Clear and redraw
    ctx.clearRect(0, 0, rect.width, rect.height);

    // First render existing graffiti
    renderGraffitiStrokes(ctx, existingGraffiti, rect.width, rect.height);

    // Then render new strokes on top (including single-point taps)
    const allStrokes = [...strokes, currentStroke].filter(s => s.length >= 1);
    const newGraffitiToRender: Graffiti[] = allStrokes.map((stroke, i) => ({
      id: `temp-${i}`,
      wall,
      implement,
      strokeData: [stroke],
      color: IMPLEMENT_STYLES[implement].color,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      opacity: 1,
    }));

    renderGraffitiStrokes(ctx, newGraffitiToRender, rect.width, rect.height);
  }, [strokes, currentStroke, implement, existingGraffiti, wall]);

  const getPointFromTouch = useCallback((touch: React.Touch): StrokePoint | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height,
    };
  }, []);

  const getPointFromMouse = useCallback((e: React.MouseEvent): StrokePoint | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const point = getPointFromTouch(e.touches[0]);
    if (!point) return;

    setIsDrawing(true);
    setCurrentStroke([point]);
    lastPointRef.current = {
      x: point.x,
      y: point.y,
      time: Date.now(),
    };
  }, [getPointFromTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const point = getPointFromTouch(e.touches[0]);
    if (!point) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const now = Date.now();

    // For carved mode, check velocity
    if (implement === 'carved' && lastPointRef.current) {
      const dx = (point.x - lastPointRef.current.x) * rect.width;
      const dy = (point.y - lastPointRef.current.y) * rect.height;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const timeDelta = now - lastPointRef.current.time;

      if (timeDelta > 0) {
        const velocity = distance / timeDelta;
        if (velocity > CARVE_VELOCITY_THRESHOLD) {
          // Too fast - don't add point (line breaks)
          lastPointRef.current = { x: point.x, y: point.y, time: now };
          return;
        }
      }
    }

    setCurrentStroke((prev) => [...prev, point]);
    lastPointRef.current = { x: point.x, y: point.y, time: now };
  }, [isDrawing, implement, getPointFromTouch]);

  const handleTouchEnd = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    // Allow single-point strokes (taps) - they'll be rendered as dots
    if (currentStroke.length >= 1) {
      setStrokes((prev) => [...prev, currentStroke]);
      // Lock implement after first stroke
      if (!isImplementLocked) {
        setIsImplementLocked(true);
      }
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke, isImplementLocked]);

  // Mouse event handlers for desktop support
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const point = getPointFromMouse(e);
    if (!point) return;

    setIsDrawing(true);
    setCurrentStroke([point]);
    lastPointRef.current = {
      x: point.x,
      y: point.y,
      time: Date.now(),
    };
  }, [getPointFromMouse]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;

    const point = getPointFromMouse(e);
    if (!point) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const now = Date.now();

    // For carved mode, check velocity
    if (implement === 'carved' && lastPointRef.current) {
      const dx = (point.x - lastPointRef.current.x) * rect.width;
      const dy = (point.y - lastPointRef.current.y) * rect.height;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const timeDelta = now - lastPointRef.current.time;

      if (timeDelta > 0) {
        const velocity = distance / timeDelta;
        if (velocity > CARVE_VELOCITY_THRESHOLD) {
          lastPointRef.current = { x: point.x, y: point.y, time: now };
          return;
        }
      }
    }

    setCurrentStroke((prev) => [...prev, point]);
    lastPointRef.current = { x: point.x, y: point.y, time: now };
  }, [isDrawing, implement, getPointFromMouse]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    // Allow single-point strokes (clicks) - they'll be rendered as dots
    if (currentStroke.length >= 1) {
      setStrokes((prev) => [...prev, currentStroke]);
      // Lock implement after first stroke
      if (!isImplementLocked) {
        setIsImplementLocked(true);
      }
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke, isImplementLocked]);

  const handleSubmit = () => {
    if (strokes.length === 0) return;
    onSubmit(strokes, implement);
  };

  const wallLabel = wall === 'front' ? 'door' : `${wall} wall`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#2a2a2a]">
      {/* Header - mobile-optimized touch targets (WCAG 44x44px minimum) */}
      <div className="flex items-center justify-between px-2 py-2 bg-[#3a3a3a]">
        <button
          onClick={onCancel}
          className="text-[#aaa] text-base hover:text-[#ccc] min-h-[44px] min-w-[44px] px-3 flex items-center justify-center"
          aria-label="Cancel drawing"
        >
          Cancel
        </button>
        <span className="text-[#888] text-sm">
          {wallLabel}
        </span>
        <button
          onClick={handleSubmit}
          disabled={strokes.length === 0}
          className={`text-base font-medium min-h-[44px] min-w-[44px] px-3 flex items-center justify-center ${
            strokes.length > 0
              ? 'text-[#e8e0d5] hover:text-white'
              : 'text-[#666] cursor-not-allowed'
          }`}
          aria-label="Done drawing"
        >
          Done
        </button>
      </div>

      {/* Drawing canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-gradient-to-b from-[#f5f0e8] to-[#e8e0d5]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(139, 134, 133, 0.1) 0%, transparent 30%),
            radial-gradient(circle at 80% 20%, rgba(139, 134, 133, 0.08) 0%, transparent 25%)
          `,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Texture overlay */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          }}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
        />

        {/* Hint text for carved mode only, when user hasn't started drawing */}
        {implement === 'carved' && strokes.length === 0 && currentStroke.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[#999] text-sm">Move slowly to carve</p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="px-4 py-4 bg-[#3a3a3a] flex flex-col items-center gap-2">
        <ImplementPicker
          selected={implement}
          onChange={setImplement}
          disabled={isImplementLocked}
        />
        {isImplementLocked && (
          <p className="text-[#888] text-xs">
            Implement locked after first stroke
          </p>
        )}
      </div>
    </div>
  );
}
