"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as THREE from "three";
import {
  type Stroke,
  type StrokePoint,
  type ImplementType,
  type WallType,
  type Graffiti,
  IMPLEMENT_STYLES,
} from "@/lib/config";
import { renderGraffitiStrokes } from "@/lib/wall-rendering";
import {
  shouldAcceptPoint,
  createTimedPoint,
  type TimedPoint,
} from "@/lib/velocity-gating";
import {
  calculateWallBounds,
  isPointNearStroke,
  type FacingDirection,
} from "@/lib/geometry";
import { trackEvent } from "@/lib/analytics";

// Number of angle directions for carved mode (8 = every 45°)
const CARVE_ANGLE_DIVISIONS = 8;
const CARVE_ANGLE_STEP = (Math.PI * 2) / CARVE_ANGLE_DIVISIONS;

// Minimum distance (in normalized 0-1 coords) before snapping kicks in
// Below this, we just use the raw point to avoid jitter at stroke start
const CARVE_MIN_SNAP_DISTANCE = 0.01;

/**
 * Snaps a point to the nearest allowed angle direction from a reference point.
 * Used for carved mode to create angular, deliberate-looking strokes.
 */
function snapToAngle(
  fromPoint: StrokePoint,
  toPoint: StrokePoint
): StrokePoint {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Don't snap very short movements - prevents jitter
  if (distance < CARVE_MIN_SNAP_DISTANCE) {
    return toPoint;
  }

  // Get current angle and snap to nearest allowed angle
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / CARVE_ANGLE_STEP) * CARVE_ANGLE_STEP;

  // Calculate new point at same distance but snapped angle
  return {
    x: fromPoint.x + Math.cos(snappedAngle) * distance,
    y: fromPoint.y + Math.sin(snappedAngle) * distance,
  };
}

interface UseDrawingOptions {
  facing: FacingDirection;
  wallDistance: number;
  wallHeight: number;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  graffiti: Record<WallType, Graffiti[]>;
  onSubmit: (
    wall: WallType,
    strokeData: Stroke[],
    implement: ImplementType
  ) => void;
  selectorMode?: boolean;
  onSelectGraffiti?: (graffiti: Graffiti[]) => void;
}

interface UseDrawingReturn {
  implement: ImplementType;
  setImplement: (implement: ImplementType) => void;
  strokes: Stroke[];
  currentStroke: StrokePoint[];
  isDrawing: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasDimensions: { width: number; height: number };
  handleDrawStart: (clientX: number, clientY: number) => void;
  handleDrawMove: (clientX: number, clientY: number) => void;
  handleDrawEnd: () => void;
}

/**
 * Hook for managing all drawing state and logic
 */
export function useDrawing({
  facing,
  wallDistance,
  wallHeight,
  cameraRef,
  graffiti,
  onSubmit,
  selectorMode = false,
  onSelectGraffiti,
}: UseDrawingOptions): UseDrawingReturn {
  const [implement, setImplement] = useState<ImplementType>("scribble");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<TimedPoint | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 480,
    height: 736,
  });

  // Wrapper to track implement changes
  const handleImplementChange = useCallback((newImplement: ImplementType) => {
    setImplement(newImplement);
    trackEvent("implement_selected", { implement: newImplement });
  }, []);

  // Canvas setup for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      // Cap DPR at 2 to match texture generation
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      setCanvasDimensions({
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      });
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Clear preview strokes when graffiti is added to 3D texture
  useEffect(() => {
    if (strokes.length > 0 && graffiti[facing].length > 0) {
      setStrokes([]);
    }
  }, [graffiti, facing, strokes.length]);

  // Redraw canvas when strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);

    // Render current drawing strokes (including single-point taps)
    const allStrokes = [...strokes, currentStroke].filter((s) => s.length >= 1);
    const graffitiToRender: Graffiti[] = allStrokes.map((stroke, i) => ({
      id: `temp-${i}`,
      wall: facing,
      implement,
      strokeData: [stroke],
      color: IMPLEMENT_STYLES[implement].color,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      opacity: 1,
    }));

    // For all walls, render within wall bounds to match 3D texture
    if (camera) {
      const wallBounds = calculateWallBounds(
        camera,
        width,
        height,
        wallDistance,
        wallHeight,
        facing
      );

      if (wallBounds) {
        ctx.save();
        ctx.translate(wallBounds.minX, wallBounds.minY);
        const wallWidth = wallBounds.maxX - wallBounds.minX;
        const wallHeightPx = wallBounds.maxY - wallBounds.minY;
        renderGraffitiStrokes(ctx, graffitiToRender, wallWidth, wallHeightPx);
        ctx.restore();
        return;
      }
    }

    // Fallback: render using full viewport dimensions
    renderGraffitiStrokes(ctx, graffitiToRender, width, height);
  }, [
    strokes,
    currentStroke,
    implement,
    facing,
    wallDistance,
    wallHeight,
    cameraRef,
  ]);

  // Get normalized point from screen coordinates
  const getPointFromEvent = useCallback(
    (clientX: number, clientY: number): StrokePoint | null => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return null;

      const rect = canvas.getBoundingClientRect();

      const wallBounds = calculateWallBounds(
        camera,
        rect.width,
        rect.height,
        wallDistance,
        wallHeight,
        facing
      );

      if (wallBounds) {
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Check if click is within wall bounds
        if (
          canvasX < wallBounds.minX ||
          canvasX > wallBounds.maxX ||
          canvasY < wallBounds.minY ||
          canvasY > wallBounds.maxY
        ) {
          return null;
        }

        // Normalize relative to wall bounds (0-1 within wall area)
        const x =
          (canvasX - wallBounds.minX) / (wallBounds.maxX - wallBounds.minX);
        const y =
          (canvasY - wallBounds.minY) / (wallBounds.maxY - wallBounds.minY);

        return { x, y };
      }

      return null;
    },
    [facing, wallDistance, wallHeight, cameraRef]
  );

  const handleDrawStart = useCallback(
    (clientX: number, clientY: number) => {
      const point = getPointFromEvent(clientX, clientY);
      if (!point) return;

      // If in selector mode, find graffiti near this point
      if (selectorMode) {
        const currentWallGraffiti = graffiti[facing];
        const matches: Graffiti[] = [];

        currentWallGraffiti.forEach((g) => {
          g.strokeData.forEach((stroke) => {
            if (isPointNearStroke(point, stroke, 0.05)) {
              if (!matches.find((m) => m.id === g.id)) {
                matches.push(g);
              }
            }
          });
        });

        onSelectGraffiti?.(matches);
        return;
      }

      // Normal drawing mode
      setIsDrawing(true);
      setCurrentStroke([point]);
      lastPointRef.current = createTimedPoint(point);

      trackEvent("drawing_started", { wall: facing, implement });
    },
    [
      getPointFromEvent,
      selectorMode,
      graffiti,
      facing,
      implement,
      onSelectGraffiti,
    ]
  );

  const handleDrawMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing || selectorMode) return;

      const point = getPointFromEvent(clientX, clientY);
      if (!point) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      // For carved mode, check velocity and snap angles
      if (implement === "carved" && lastPointRef.current) {
        if (
          !shouldAcceptPoint(
            lastPointRef.current,
            point,
            rect.width,
            rect.height
          )
        ) {
          lastPointRef.current = createTimedPoint(point);
          return;
        }

        // Snap to angular directions for that deliberate carved look
        const snappedPoint = snapToAngle(lastPointRef.current, point);
        setCurrentStroke((prev) => [...prev, snappedPoint]);
        lastPointRef.current = createTimedPoint(snappedPoint);
        return;
      }

      setCurrentStroke((prev) => [...prev, point]);
      lastPointRef.current = createTimedPoint(point);
    },
    [isDrawing, implement, getPointFromEvent, selectorMode]
  );

  const handleDrawEnd = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    // Allow single-point strokes (taps) - they'll be rendered as dots
    if (currentStroke.length >= 1) {
      const newStrokes = [...strokes, currentStroke];

      // Debug logging
      if (cameraRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const wallBounds = calculateWallBounds(
          cameraRef.current,
          canvas.clientWidth,
          canvas.clientHeight,
          wallDistance,
          wallHeight,
          facing
        );
        console.log("=== DRAW END ===");
        console.log("Wall:", facing);
        console.log(
          "Canvas dimensions:",
          canvas.clientWidth,
          "x",
          canvas.clientHeight
        );
        console.log("Wall bounds (pixels):", wallBounds);
        console.log("Stroke points:", currentStroke.length);
        console.log("First stroke point (0-1 within wall):", currentStroke[0]);
        if (currentStroke.length > 1) {
          console.log(
            "Last stroke point (0-1 within wall):",
            currentStroke[currentStroke.length - 1]
          );
        }
      }

      trackEvent("drawing_submitted", {
        wall: facing,
        implement,
        strokeCount: newStrokes.length,
      });

      // Auto-submit with raw coordinates
      onSubmit(facing, newStrokes, implement);
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [
    isDrawing,
    currentStroke,
    strokes,
    facing,
    implement,
    onSubmit,
    wallDistance,
    wallHeight,
    cameraRef,
  ]);

  return {
    implement,
    setImplement: handleImplementChange,
    strokes,
    currentStroke,
    isDrawing,
    canvasRef,
    canvasDimensions,
    handleDrawStart,
    handleDrawMove,
    handleDrawEnd,
  };
}
