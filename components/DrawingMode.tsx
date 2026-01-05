'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ImplementPicker } from './ImplementPicker';
import {
  type ImplementType,
  type WallType,
  type Stroke,
  type StrokePoint,
  IMPLEMENT_STYLES,
  CARVE_VELOCITY_THRESHOLD,
} from '@/lib/config';

interface DrawingModeProps {
  wall: WallType;
  onSubmit: (strokeData: Stroke[], implement: ImplementType) => void;
  onCancel: () => void;
}

export function DrawingMode({ wall, onSubmit, onCancel }: DrawingModeProps) {
  const [implement, setImplement] = useState<ImplementType>('scribble');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

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

    // Draw completed strokes
    const style = IMPLEMENT_STYLES[implement];
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;

    if (implement === 'carved') {
      ctx.setLineDash([2, 1]);
    } else {
      ctx.setLineDash([]);
    }

    [...strokes, currentStroke].forEach((stroke) => {
      if (stroke.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);

      for (let i = 1; i < stroke.length; i++) {
        const x = stroke[i].x * rect.width;
        const y = stroke[i].y * rect.height;

        if (implement === 'scribble') {
          const wobble = (Math.random() - 0.5) * 1;
          ctx.lineTo(x + wobble, y + wobble);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    });
  }, [strokes, currentStroke, implement]);

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
    if (currentStroke.length >= 2) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke]);

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
    if (currentStroke.length >= 2) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke]);

  const handleSubmit = () => {
    if (strokes.length === 0) return;
    onSubmit(strokes, implement);
  };

  const wallLabel = wall === 'front' ? 'door' : `${wall} wall`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#2a2a2a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#3a3a3a]">
        <button
          onClick={onCancel}
          className="text-[#aaa] text-sm hover:text-[#ccc]"
        >
          Cancel
        </button>
        <span className="text-[#888] text-xs">
          {wallLabel}
        </span>
        <button
          onClick={handleSubmit}
          disabled={strokes.length === 0}
          className={`text-sm font-medium ${
            strokes.length > 0
              ? 'text-[#e8e0d5] hover:text-white'
              : 'text-[#666]'
          }`}
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

        {/* Hint text when empty */}
        {strokes.length === 0 && currentStroke.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[#999] text-sm">
              {implement === 'carved' ? 'Move slowly to carve' : 'Draw something'}
            </p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="px-4 py-4 bg-[#3a3a3a] flex justify-center">
        <ImplementPicker selected={implement} onChange={setImplement} />
      </div>
    </div>
  );
}
