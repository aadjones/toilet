"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  type Graffiti,
  type WallType,
  type Stroke,
  type StrokePoint,
  type ImplementType,
  POLL_INTERVAL_MS,
  IMPLEMENT_STYLES,
} from "@/lib/config";
import { renderGraffitiStrokes } from "@/lib/wall-rendering";
import { ImplementPicker } from "./ImplementPicker";
import {
  createWallTexture,
  createDoorTexture,
  createFloorTexture,
  createCeilingTexture,
} from "@/lib/texture-generation";
import {
  shouldAcceptPoint,
  createTimedPoint,
  type TimedPoint,
} from "@/lib/velocity-gating";
import { trackEvent } from "@/lib/analytics";
import { HEADER_MESSAGES } from "@/lib/header-messages";

interface StallView3DProps {
  onSubmit: (
    wall: WallType,
    strokeData: Stroke[],
    implement: ImplementType
  ) => void;
  stallRef?: React.MutableRefObject<any>;
  debugUnlimitedPosting?: boolean;
  onDebugUnlimitedPostingChange?: (enabled: boolean) => void;
}

type FacingDirection = "front" | "left" | "right";

// Convert facing direction to camera rotation (Y-axis radians)
const FACING_TO_ROTATION: Record<FacingDirection, number> = {
  front: 0,
  left: Math.PI / 2, // 90 degrees left
  right: -Math.PI / 2, // 90 degrees right
};

// Helper to check if a point is near a stroke (within threshold distance)
function isPointNearStroke(
  point: StrokePoint,
  stroke: Stroke,
  threshold: number = 0.05 // 5% of canvas dimension
): boolean {
  for (let i = 0; i < stroke.length - 1; i++) {
    const p1 = stroke[i];
    const p2 = stroke[i + 1];

    // Calculate distance from point to line segment
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Point to point distance
      const dist = Math.sqrt(
        (point.x - p1.x) ** 2 + (point.y - p1.y) ** 2
      );
      if (dist < threshold) return true;
    } else {
      // Point to line segment distance
      let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
      t = Math.max(0, Math.min(1, t));

      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const dist = Math.sqrt(
        (point.x - projX) ** 2 + (point.y - projY) ** 2
      );

      if (dist < threshold) return true;
    }
  }
  return false;
}

// Helper to calculate screen-space bounding box of a wall based on facing direction
function calculateWallBounds(
  camera: THREE.Camera,
  canvasWidth: number,
  canvasHeight: number,
  wallDistance: number,
  wallHeight: number,
  facing: "front" | "left" | "right"
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return null;

  const perspectiveCamera = camera as THREE.PerspectiveCamera;

  // Wall geometry matches StallGeometry component
  const stallWidth = wallDistance * 2;
  const floorGap = 0.09;
  const adjustedWallHeight = wallHeight - floorGap;
  const wallCenterY = floorGap / 2;
  const stallDepth = 2.4;
  const backZ = 1.8;
  const frontZ = backZ - stallDepth;

  let wallCorners: THREE.Vector3[];

  if (facing === "front") {
    // Front wall (door) - vertical plane at frontZ
    wallCorners = [
      new THREE.Vector3(
        -stallWidth / 2,
        wallCenterY - adjustedWallHeight / 2,
        frontZ
      ), // bottom-left
      new THREE.Vector3(
        stallWidth / 2,
        wallCenterY - adjustedWallHeight / 2,
        frontZ
      ), // bottom-right
      new THREE.Vector3(
        -stallWidth / 2,
        wallCenterY + adjustedWallHeight / 2,
        frontZ
      ), // top-left
      new THREE.Vector3(
        stallWidth / 2,
        wallCenterY + adjustedWallHeight / 2,
        frontZ
      ), // top-right
    ];
  } else if (facing === "left") {
    // Left wall - vertical plane at x = -wallDistance, extends in Z
    wallCorners = [
      new THREE.Vector3(
        -wallDistance,
        wallCenterY - adjustedWallHeight / 2,
        backZ
      ), // bottom-back
      new THREE.Vector3(
        -wallDistance,
        wallCenterY - adjustedWallHeight / 2,
        frontZ
      ), // bottom-front
      new THREE.Vector3(
        -wallDistance,
        wallCenterY + adjustedWallHeight / 2,
        backZ
      ), // top-back
      new THREE.Vector3(
        -wallDistance,
        wallCenterY + adjustedWallHeight / 2,
        frontZ
      ), // top-front
    ];
  } else {
    // facing === 'right'
    // Right wall - vertical plane at x = wallDistance, extends in Z
    wallCorners = [
      new THREE.Vector3(
        wallDistance,
        wallCenterY - adjustedWallHeight / 2,
        frontZ
      ), // bottom-front
      new THREE.Vector3(
        wallDistance,
        wallCenterY - adjustedWallHeight / 2,
        backZ
      ), // bottom-back
      new THREE.Vector3(
        wallDistance,
        wallCenterY + adjustedWallHeight / 2,
        frontZ
      ), // top-front
      new THREE.Vector3(
        wallDistance,
        wallCenterY + adjustedWallHeight / 2,
        backZ
      ), // top-back
    ];
  }

  // Project to screen space (-1 to 1 in NDC)
  const screenCorners = wallCorners.map((corner) => {
    const projected = corner.clone().project(perspectiveCamera);
    return {
      x: (projected.x + 1) * 0.5 * canvasWidth,
      y: (1 - (projected.y + 1) * 0.5) * canvasHeight, // Flip Y for screen coords
    };
  });

  // Find bounding box
  const xs = screenCorners.map((c) => c.x);
  const ys = screenCorners.map((c) => c.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

// Camera controller component
function CameraController({
  targetRotation,
  isTransitioning,
  setIsTransitioning,
  cameraY,
  fov,
  onCameraReady,
}: {
  targetRotation: number;
  isTransitioning: boolean;
  setIsTransitioning: (v: boolean) => void;
  cameraY: number;
  fov: number;
  onCameraReady?: (camera: THREE.Camera) => void;
}) {
  const { camera } = useThree();
  const currentRotation = useRef(targetRotation);
  const initialized = useRef(false);

  // Initialize camera on mount
  useEffect(() => {
    if (!initialized.current) {
      // Position camera back in the stall (positive Z) looking forward
      camera.position.set(0, cameraY, 1.2);
      camera.rotation.set(0, 0, 0); // Reset rotation
      camera.lookAt(0, cameraY, -1); // Look forward toward door (negative Z)
      currentRotation.current = targetRotation;
      initialized.current = true;
      onCameraReady?.(camera);
    }
  }, [camera, targetRotation, cameraY, onCameraReady]);

  // Update camera Y position when it changes
  useEffect(() => {
    camera.position.y = cameraY;
  }, [camera, cameraY]);

  // Update FOV when it changes
  useEffect(() => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [camera, fov]);

  useFrame((_, delta) => {
    if (isTransitioning) {
      // Smooth rotation towards target
      const diff = targetRotation - currentRotation.current;

      // Handle wrapping around PI
      let adjustedDiff = diff;
      if (Math.abs(diff) > Math.PI) {
        adjustedDiff = diff > 0 ? diff - Math.PI * 2 : diff + Math.PI * 2;
      }

      const speed = 5.3; // Slowed down from 8 (1.5x slower)
      currentRotation.current += adjustedDiff * delta * speed;

      // Snap to target when close enough
      if (Math.abs(adjustedDiff) < 0.01) {
        currentRotation.current = targetRotation;
        setIsTransitioning(false);
      }
    }

    // Always apply rotation
    camera.rotation.y = currentRotation.current;
  });

  return null;
}

// The actual 3D stall geometry
function StallGeometry({
  graffiti,
  wallDistance = 0.5,
  wallHeight = 2.0,
  canvasWidth = 480,
  canvasHeight = 736,
}: {
  graffiti: Record<WallType, Graffiti[]>;
  wallDistance?: number;
  wallHeight?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}) {
  // Create stable keys for memoization based on graffiti content
  const frontKey = useMemo(
    () => graffiti.front.map((g) => `${g.id}-${g.opacity}`).join(","),
    [graffiti.front]
  );
  const leftKey = useMemo(
    () => graffiti.left.map((g) => `${g.id}-${g.opacity}`).join(","),
    [graffiti.left]
  );
  const rightKey = useMemo(
    () => graffiti.right.map((g) => `${g.id}-${g.opacity}`).join(","),
    [graffiti.right]
  );

  // Create textures - use canvas dimensions for perfect aspect ratio match
  const frontTexture = useMemo(() => {
    return createDoorTexture(graffiti.front, canvasWidth, canvasHeight);
  }, [frontKey, canvasWidth, canvasHeight, graffiti.front]);
  const leftTexture = useMemo(
    () => createWallTexture(graffiti.left, 512, 512, true),
    [leftKey, graffiti.left]
  );
  const rightTexture = useMemo(
    () => createWallTexture(graffiti.right, 512, 512, false),
    [rightKey, graffiti.right]
  );
  const floorTexture = useMemo(() => createFloorTexture(512), []);
  const ceilingTexture = useMemo(() => createCeilingTexture(512), []);

  // Stall geometry: camera is at (0, cameraY, 1.2)
  // Side walls extend from back of stall to front where door is
  const stallDepth = 2.4; // Total depth from back to front
  const backZ = 1.8; // Back wall position (behind camera)
  const frontZ = backZ - stallDepth; // Front wall/door position
  const stallWidth = wallDistance * 2;

  // Extended dimensions to fill viewport without black gaps
  const extendedFloorWidth = stallWidth * 3; // Much wider floor
  const extendedFloorDepth = stallDepth * 2; // Much deeper floor

  // American-style stall partition: walls don't touch the floor
  const floorGap = 0.09; // ~9cm gap between wall bottom and floor
  const adjustedWallHeight = wallHeight - floorGap;
  // Position walls so the gap is at the bottom
  const wallCenterY = floorGap / 2;

  return (
    <group>
      {/* Front wall (door) - at the FRONT edge of the side walls */}
      <mesh position={[0, wallCenterY, frontZ]} rotation={[0, 0, 0]}>
        <planeGeometry args={[stallWidth, adjustedWallHeight]} />
        <meshLambertMaterial map={frontTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Left wall - extends from back to front (where door is) */}
      <mesh
        position={[-wallDistance, wallCenterY, (backZ + frontZ) / 2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[stallDepth, adjustedWallHeight]} />
        <meshLambertMaterial map={leftTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Right wall - extends from back to front (where door is) */}
      <mesh
        position={[wallDistance, wallCenterY, (backZ + frontZ) / 2]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[stallDepth, adjustedWallHeight]} />
        <meshLambertMaterial map={rightTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Back wall behind camera - light beige to blend with bathroom */}
      <mesh position={[0, wallCenterY, backZ + 0.5]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[extendedFloorWidth, adjustedWallHeight]} />
        <meshLambertMaterial color="#e8dfd0" side={THREE.FrontSide} />
      </mesh>

      {/* Extended floor - covers entire visible area */}
      <mesh
        position={[0, -wallHeight / 2, (backZ + frontZ) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[extendedFloorWidth, extendedFloorDepth]} />
        <meshLambertMaterial map={floorTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Extended ceiling - covers entire visible area */}
      <mesh
        position={[0, wallHeight / 2, (backZ + frontZ) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[extendedFloorWidth, extendedFloorDepth]} />
        <meshLambertMaterial map={ceilingTexture} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

export function StallView3D({
  onSubmit,
  stallRef,
  debugUnlimitedPosting = false,
  onDebugUnlimitedPostingChange,
}: StallView3DProps) {
  const [facing, setFacing] = useState<FacingDirection>("front");
  const [graffiti, setGraffiti] = useState<Record<WallType, Graffiti[]>>({
    front: [],
    left: [],
    right: [],
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);

  // Random message on mount (client-side only to avoid hydration mismatch)
  const [headerMessage, setHeaderMessage] = useState<string>(HEADER_MESSAGES[0]);

  // Set random message on mount (client-side only)
  useEffect(() => {
    setHeaderMessage(
      HEADER_MESSAGES[Math.floor(Math.random() * HEADER_MESSAGES.length)]
    );
    // Track session start
    trackEvent('session_start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drawing state
  const [implement, setImplement] = useState<ImplementType>("scribble");

  // Wrapper to track implement changes
  const handleImplementChange = useCallback((newImplement: ImplementType) => {
    setImplement(newImplement);
    trackEvent('implement_selected', { implement: newImplement });
  }, []);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<TimedPoint | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  // Track canvas dimensions for texture generation
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 480,
    height: 736,
  });

  // Debug controls
  const [showDebug, setShowDebug] = useState(false);
  const [fov, setFov] = useState(72); // Field of view from user's preferred settings
  const [cameraY, setCameraY] = useState(0.25); // Eye height from user's preferred settings
  const [wallDistance, setWallDistance] = useState(0.5); // Wall distance from user's preferred settings
  const [wallHeight, setWallHeight] = useState(2.0);
  const [selectorMode, setSelectorMode] = useState(false);
  const [selectedGraffiti, setSelectedGraffiti] = useState<Graffiti[]>([]);

  // Expose graffiti getter via ref so parent can access current wall graffiti
  const getWallGraffiti = useCallback(
    (wall: WallType): Graffiti[] => {
      return graffiti[wall];
    },
    [graffiti]
  );

  // Fetch graffiti for all walls
  const fetchGraffiti = useCallback(async () => {
    try {
      const walls: WallType[] = ["front", "left", "right"];
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
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch graffiti:", error);
      setIsLoading(false);
    }
  }, []);

  // Delete specific graffiti by ID
  const deleteGraffiti = useCallback(async (id: string) => {
    try {
      const response = await fetch("/api/graffiti/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        // Remove from local state
        setGraffiti((prev) => ({
          front: prev.front.filter((g) => g.id !== id),
          left: prev.left.filter((g) => g.id !== id),
          right: prev.right.filter((g) => g.id !== id),
        }));
        // Remove from selected list if present
        setSelectedGraffiti((prev) => prev.filter((g) => g.id !== id));
        console.log("Graffiti deleted:", id);
      } else {
        console.error("Failed to delete graffiti");
      }
    } catch (error) {
      console.error("Error deleting graffiti:", error);
    }
  }, []);

  // Clear all graffiti from database
  const clearAllGraffiti = useCallback(async () => {
    if (!confirm("Clear all graffiti from all walls? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/graffiti/clear", {
        method: "POST",
      });

      if (response.ok) {
        // Clear local state
        setGraffiti({
          front: [],
          left: [],
          right: [],
        });
        setSelectedGraffiti([]);
        console.log("All graffiti cleared");
      } else {
        console.error("Failed to clear graffiti");
      }
    } catch (error) {
      console.error("Error clearing graffiti:", error);
    }
  }, []);

  // Add graffiti instantly (called from DrawingMode)
  const addLocalGraffiti = useCallback(
    (wall: WallType, newGraffiti: Graffiti) => {
      setGraffiti((prev) => ({
        ...prev,
        [wall]: [...prev[wall], newGraffiti],
      }));
    },
    []
  );

  // Expose methods via ref
  useEffect(() => {
    if (stallRef) {
      stallRef.current = { addLocalGraffiti, getWallGraffiti };
    }
  }, [addLocalGraffiti, getWallGraffiti, stallRef]);

  // Initial fetch and polling
  useEffect(() => {
    fetchGraffiti();
    const interval = setInterval(fetchGraffiti, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchGraffiti]);

  // Rotation logic
  const rotate = useCallback(
    (direction: "left" | "right") => {
      if (isTransitioning) return;

      setIsTransitioning(true);
      setFacing((prev) => {
        let newFacing = prev;
        // Turn head right = see right wall
        if (direction === "right") {
          if (prev === "front") newFacing = "right";
          else if (prev === "left") newFacing = "front";
          else if (prev === "right") newFacing = "left";
        } else {
          // Turn head left = see left wall
          if (prev === "front") newFacing = "left";
          else if (prev === "right") newFacing = "front";
          else if (prev === "left") newFacing = "right";
        }

        // Track rotation
        if (newFacing !== prev) {
          trackEvent('wall_rotation', { from: prev, to: newFacing });
        }

        return newFacing;
      });
    },
    [isTransitioning]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "`") {
        e.preventDefault();
        setShowDebug((prev) => !prev);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        rotate("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        rotate("right");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rotate]);

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

      // Update dimensions for texture generation
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
    // When graffiti updates for the current wall, clear any preview strokes
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

    // Clear using client dimensions (CSS dimensions) since context is scaled by DPR
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
        // Save context state
        ctx.save();

        // Translate to wall bounds and scale to wall size
        ctx.translate(wallBounds.minX, wallBounds.minY);
        const wallWidth = wallBounds.maxX - wallBounds.minX;
        const wallHeightPx = wallBounds.maxY - wallBounds.minY;

        // Render strokes normalized to wall size (0-1 becomes wall dimensions)
        renderGraffitiStrokes(ctx, graffitiToRender, wallWidth, wallHeightPx);

        ctx.restore();
        return;
      }
    }

    // Fallback: render using full viewport dimensions
    renderGraffitiStrokes(ctx, graffitiToRender, width, height);
  }, [strokes, currentStroke, implement, facing, wallDistance, wallHeight]);

  // Drawing handlers
  const getPointFromEvent = useCallback(
    (clientX: number, clientY: number): StrokePoint | null => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return null;

      const rect = canvas.getBoundingClientRect();

      // Calculate wall bounds for current facing direction
      const wallBounds = calculateWallBounds(
        camera,
        rect.width,
        rect.height,
        wallDistance,
        wallHeight,
        facing
      );

      if (wallBounds) {
        // Convert client coordinates to canvas-relative coordinates
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Check if click is within wall bounds
        if (
          canvasX < wallBounds.minX ||
          canvasX > wallBounds.maxX ||
          canvasY < wallBounds.minY ||
          canvasY > wallBounds.maxY
        ) {
          // Click is outside the wall - ignore it
          return null;
        }

        // Normalize relative to wall bounds (0-1 within wall area)
        const x =
          (canvasX - wallBounds.minX) / (wallBounds.maxX - wallBounds.minX);
        const y =
          (canvasY - wallBounds.minY) / (wallBounds.maxY - wallBounds.minY);

        return { x, y };
      }

      // If wall bounds calculation fails, don't allow drawing
      return null;
    },
    [facing, wallDistance, wallHeight]
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

        setSelectedGraffiti(matches);
        return;
      }

      // Normal drawing mode
      setIsDrawing(true);
      setCurrentStroke([point]);
      lastPointRef.current = createTimedPoint(point);

      // Track drawing started
      trackEvent('drawing_started', { wall: facing, implement });
    },
    [getPointFromEvent, selectorMode, graffiti, facing, implement]
  );

  const handleDrawMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawing || selectorMode) return;

      const point = getPointFromEvent(clientX, clientY);
      if (!point) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      // For carved mode, check velocity
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
      // Don't transform - save raw screen coordinates
      const newStrokes = [...strokes, currentStroke];

      // DEBUG: Log coordinates being submitted
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

      // Track drawing submitted
      trackEvent('drawing_submitted', {
        wall: facing,
        implement,
        strokeCount: newStrokes.length,
      });

      // Auto-submit with raw coordinates (no transformation)
      onSubmit(facing, newStrokes, implement);

      // Don't clear strokes yet - wait for addLocalGraffiti to add to 3D texture
      // This prevents the flicker where preview disappears before 3D texture updates
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke, strokes, facing, implement, onSubmit, wallDistance, wallHeight]);

  // Touch/swipe handlers - need to distinguish between swipe and draw
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;

    // Start drawing immediately
    handleDrawStart(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX.current;
    const threshold = 50;

    // Only rotate if it was a swipe (and not a draw)
    if (!isDrawing && Math.abs(diff) > threshold && !isTransitioning) {
      rotate(diff > 0 ? "left" : "right");
    }

    handleDrawEnd();
    touchStartX.current = null;
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDrawStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDrawMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleDrawEnd();
  };

  // Touch event listeners with non-passive option to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchMoveNonPassive = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleDrawMove(touch.clientX, touch.clientY);
    };

    container.addEventListener("touchmove", handleTouchMoveNonPassive, {
      passive: false,
    });
    return () =>
      container.removeEventListener("touchmove", handleTouchMoveNonPassive);
  }, [handleDrawMove]);

  const targetRotation = FACING_TO_ROTATION[facing];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        camera={{
          fov: fov,
          near: 0.1,
          far: 100,
          position: [0, cameraY, 0],
        }}
        gl={{ antialias: true }}
      >
        <CameraController
          targetRotation={targetRotation}
          isTransitioning={isTransitioning}
          setIsTransitioning={setIsTransitioning}
          cameraY={cameraY}
          fov={fov}
          onCameraReady={(camera) => {
            cameraRef.current = camera;
          }}
        />

        {/* Ambient lighting - brighten to see floor gap clearly */}
        <ambientLight intensity={0.9} />

        {/* Directional light from above (fluorescent) */}
        <directionalLight position={[0, 2, 0]} intensity={0.4} />

        {/* Subtle light from below to show floor continues under walls */}
        <directionalLight
          position={[0, -1, 0]}
          intensity={0.15}
          color="#f0e8d8"
        />

        <StallGeometry
          graffiti={graffiti}
          wallDistance={wallDistance}
          wallHeight={wallHeight}
          canvasWidth={canvasDimensions.width}
          canvasHeight={canvasDimensions.height}
        />
      </Canvas>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
          <div className="text-[#999] text-sm">Loading graffiti...</div>
        </div>
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">
        {/* Header message */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <p className="text-[#c4bfb3] text-sm font-medium tracking-wide text-center px-4">
            {headerMessage}
          </p>
        </div>

        {/* Drawing canvas overlay - positioned above 3D canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-auto touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          role="img"
          aria-label={`Bathroom stall ${facing} wall - drawing canvas`}
        />

        {/* Navigation arrows - hide left arrow at left wall, hide right arrow at right wall */}
        {facing !== "left" && (
          <button
            onClick={() => rotate("left")}
            disabled={isTransitioning}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center bg-[#2b2d2f]/70 backdrop-blur-sm rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-[#54585c]/80 transition-all duration-200 pointer-events-auto disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 shadow-lg"
            aria-label="Look left"
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {facing !== "right" && (
          <button
            onClick={() => rotate("right")}
            disabled={isTransitioning}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center bg-[#2b2d2f]/70 backdrop-blur-sm rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-[#54585c]/80 transition-all duration-200 pointer-events-auto disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 shadow-lg"
            aria-label="Look right"
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Implement picker at bottom - always visible */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <ImplementPicker selected={implement} onChange={handleImplementChange} />
        </div>
      </div>

      {/* Debug panel - positioned outside the main view to the right */}
      {showDebug && (
        <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded text-xs font-mono z-50 w-72 select-text border border-white/20 shadow-2xl">
          <div className="mb-3 text-sm font-bold border-b border-white/20 pb-2">
            Debug Controls (press ` to hide)
          </div>

          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-white/70">FOV: {fov}°</label>
              <div className="text-[10px] text-white/40 mb-1">
                Field of view (wider = see more)
              </div>
              <input
                type="range"
                min="30"
                max="120"
                value={fov}
                onChange={(e) => setFov(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block mb-1 text-white/70">
                Camera Y: {cameraY.toFixed(2)}
              </label>
              <div className="text-[10px] text-white/40 mb-1">
                Eye height (0 = center, negative = lower)
              </div>
              <input
                type="range"
                min="-0.8"
                max="0.8"
                step="0.05"
                value={cameraY}
                onChange={(e) => setCameraY(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block mb-1 text-white/70">
                Wall Distance: {wallDistance.toFixed(1)}
              </label>
              <div className="text-[10px] text-white/40 mb-1">
                How far walls are from camera
              </div>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.1"
                value={wallDistance}
                onChange={(e) => setWallDistance(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block mb-1 text-white/70">
                Wall Height: {wallHeight.toFixed(1)}
              </label>
              <div className="text-[10px] text-white/40 mb-1">
                Height of walls
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={wallHeight}
                onChange={(e) => setWallHeight(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="pt-2 border-t border-white/20 text-white/50 text-[10px] leading-tight">
              Facing: {facing}
              <br />
              Camera at (0, {cameraY.toFixed(2)}, 0)
              <br />
              Front wall at Z=-{wallDistance.toFixed(1)}
            </div>

            {/* Debug options */}
            <div className="pt-3 border-t border-white/20 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugUnlimitedPosting}
                  onChange={(e) =>
                    onDebugUnlimitedPostingChange?.(e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <span className="text-white/70 text-xs">
                  Unlimited posting (bypass session limit)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectorMode}
                  onChange={(e) => {
                    setSelectorMode(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedGraffiti([]);
                    }
                  }}
                  className="w-4 h-4"
                />
                <span className="text-white/70 text-xs">
                  Selector mode (click to find graffiti)
                </span>
              </label>
            </div>

            {/* Selected graffiti list */}
            {selectorMode && selectedGraffiti.length > 0 && (
              <div className="pt-3 border-t border-white/20">
                <div className="text-white/70 text-xs font-semibold mb-2">
                  Found {selectedGraffiti.length} graffiti at clicked point:
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedGraffiti.map((g) => (
                    <div
                      key={g.id}
                      className="bg-white/5 rounded px-2 py-1.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-white/50 truncate">
                          {g.id}
                        </div>
                        <div className="text-[9px] text-white/40">
                          {g.implement} • {g.strokeData.length} stroke(s)
                        </div>
                      </div>
                      <button
                        onClick={() => deleteGraffiti(g.id)}
                        className="bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-semibold transition-colors flex-shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clear all graffiti button */}
            <div className="pt-3 border-t border-white/20">
              <button
                onClick={clearAllGraffiti}
                className="w-full bg-red-600/80 hover:bg-red-600 text-white px-3 py-2 rounded text-xs font-semibold transition-colors"
              >
                Clear All Graffiti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
