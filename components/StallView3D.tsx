'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { type Graffiti, type WallType, type Stroke, type StrokePoint, type ImplementType, POLL_INTERVAL_MS, IMPLEMENT_STYLES, CARVE_VELOCITY_THRESHOLD } from '@/lib/config';
import { renderGraffitiStrokes, calculateOpacity } from '@/lib/wall-rendering';
import { ImplementPicker } from './ImplementPicker';

interface StallView3DProps {
  onSubmit: (wall: WallType, strokeData: Stroke[], implement: ImplementType) => void;
  stallRef?: React.MutableRefObject<any>;
}

type FacingDirection = 'front' | 'left' | 'right';

// Convert facing direction to camera rotation (Y-axis radians)
const FACING_TO_ROTATION: Record<FacingDirection, number> = {
  front: 0,
  left: Math.PI / 2,    // 90 degrees left
  right: -Math.PI / 2,  // 90 degrees right
};

// Wall texture creation with graffiti
function createWallTexture(
  graffiti: Graffiti[],
  width: number,
  height: number,
  showLock: boolean = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Base wall color - beige/tan bathroom partition
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#e8dfd0');
  gradient.addColorStop(0.5, '#dfd6c7');
  gradient.addColorStop(1, '#d8cfc0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add shadow at bottom of wall to suggest elevation above floor
  const shadowGradient = ctx.createLinearGradient(0, height - 30, 0, height);
  shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.fillStyle = shadowGradient;
  ctx.fillRect(0, height - 30, width, 30);

  // Subtle wear texture
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < width; i += 4) {
    ctx.fillStyle = '#000';
    ctx.fillRect(i, 0, 1, height);
  }
  for (let i = 0; i < height; i += 6) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, i, width, 1);
  }
  ctx.globalAlpha = 1;

  // Draw lock on front wall
  if (showLock) {
    const lockX = width - 80;
    const lockY = height * 0.55;

    // Lock housing
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(lockX, lockY - 16, 65, 32);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(lockX, lockY - 16, 65, 32);

    // Occupied indicator (red circle)
    ctx.beginPath();
    ctx.arc(lockX + 18, lockY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#c0392b';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bolt mechanism
    ctx.fillStyle = '#808080';
    ctx.fillRect(lockX + 40, lockY - 5, 20, 10);
  }

  // Calculate opacity for each graffiti and render
  const graffitiWithOpacity = graffiti.map(g => ({
    ...g,
    opacity: calculateOpacity(g.createdAt, g.expiresAt, g.implement)
  }));

  renderGraffitiStrokes(ctx, graffitiWithOpacity, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create floor texture
function createFloorTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = size * dpr;
  canvas.height = size * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Checkerboard pattern
  const tileSize = 30;
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      ctx.fillStyle = isLight ? '#e8e0d0' : '#c8bfb0';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create ceiling texture
function createCeilingTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;

  const ctx = canvas.getContext('2d')!;

  // Grey ceiling
  const gradient = ctx.createLinearGradient(0, 0, 0, size * 2);
  gradient.addColorStop(0, '#b0b0b0');
  gradient.addColorStop(1, '#a0a0a0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size * 2, size * 2);

  // Fluorescent light fixture
  const lightX = size - 50;
  const lightY = size - 10;
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(lightX, lightY, 100, 20);
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 2;
  ctx.strokeRect(lightX, lightY, 100, 20);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Camera controller component
function CameraController({
  targetRotation,
  isTransitioning,
  setIsTransitioning,
  cameraY,
  fov
}: {
  targetRotation: number;
  isTransitioning: boolean;
  setIsTransitioning: (v: boolean) => void;
  cameraY: number;
  fov: number;
}) {
  const { camera } = useThree();
  const currentRotation = useRef(targetRotation);
  const initialized = useRef(false);

  // Initialize camera on mount
  useEffect(() => {
    if (!initialized.current) {
      camera.position.set(0, cameraY, 0);
      camera.rotation.set(0, 0, 0); // Reset rotation
      camera.lookAt(0, cameraY, -1); // Look forward (negative Z)
      currentRotation.current = targetRotation;
      initialized.current = true;
    }
  }, [camera, targetRotation, cameraY]);

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

      const speed = 8;
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
  wallDistance = 1.5,
  wallHeight = 2.0,
}: {
  graffiti: Record<WallType, Graffiti[]>;
  wallDistance?: number;
  wallHeight?: number;
}) {
  // Create textures with memoization
  const frontTexture = useMemo(
    () => createWallTexture(graffiti.front, 512, 512, true),
    [graffiti.front]
  );
  const leftTexture = useMemo(
    () => createWallTexture(graffiti.left, 512, 512, false),
    [graffiti.left]
  );
  const rightTexture = useMemo(
    () => createWallTexture(graffiti.right, 512, 512, false),
    [graffiti.right]
  );
  const floorTexture = useMemo(() => createFloorTexture(512), []);
  const ceilingTexture = useMemo(() => createCeilingTexture(512), []);

  const wallWidth = wallDistance * 2;

  // American-style stall partition: walls don't touch the floor
  const floorGap = 0.09; // ~9cm gap between wall bottom and floor
  const adjustedWallHeight = wallHeight - floorGap;
  // Position walls so the gap is at the bottom
  const wallCenterY = floorGap / 2;

  return (
    <group>
      {/* Front wall - facing the viewer (at -Z) */}
      <mesh position={[0, wallCenterY, -wallDistance]} rotation={[0, 0, 0]}>
        <planeGeometry args={[wallWidth, adjustedWallHeight]} />
        <meshLambertMaterial map={frontTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Left wall - at -X, rotated to face inward */}
      <mesh position={[-wallDistance, wallCenterY, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[wallWidth, adjustedWallHeight]} />
        <meshLambertMaterial map={leftTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Right wall - at +X, rotated to face inward */}
      <mesh position={[wallDistance, wallCenterY, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[wallWidth, adjustedWallHeight]} />
        <meshLambertMaterial map={rightTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Floor - at -Y, rotated to face upward */}
      <mesh position={[0, -wallHeight / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[wallWidth, wallWidth]} />
        <meshLambertMaterial map={floorTexture} side={THREE.FrontSide} />
      </mesh>

      {/* Ceiling - at +Y, rotated to face downward */}
      <mesh position={[0, wallHeight / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[wallWidth, wallWidth]} />
        <meshLambertMaterial map={ceilingTexture} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

export function StallView3D({ onSubmit, stallRef }: StallView3DProps) {
  const [facing, setFacing] = useState<FacingDirection>('front');
  const [graffiti, setGraffiti] = useState<Record<WallType, Graffiti[]>>({
    front: [],
    left: [],
    right: [],
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);

  // Drawing state
  const [implement, setImplement] = useState<ImplementType>('scribble');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Debug controls
  const [showDebug, setShowDebug] = useState(false);
  const [fov, setFov] = useState(75);
  const [cameraY, setCameraY] = useState(0);
  const [wallDistance, setWallDistance] = useState(1.5);
  const [wallHeight, setWallHeight] = useState(2.0);

  // Expose graffiti getter via ref so parent can access current wall graffiti
  const getWallGraffiti = useCallback((wall: WallType): Graffiti[] => {
    return graffiti[wall];
  }, [graffiti]);

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
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch graffiti:', error);
      setIsLoading(false);
    }
  }, []);

  // Add graffiti instantly (called from DrawingMode)
  const addLocalGraffiti = useCallback((wall: WallType, newGraffiti: Graffiti) => {
    setGraffiti((prev) => ({
      ...prev,
      [wall]: [...prev[wall], newGraffiti],
    }));
  }, []);

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
  const rotate = useCallback((direction: 'left' | 'right') => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setFacing((prev) => {
      // Turn head right = see right wall
      if (direction === 'right') {
        if (prev === 'front') return 'right';
        if (prev === 'left') return 'front';
        if (prev === 'right') return 'left';
      } else {
        // Turn head left = see left wall
        if (prev === 'front') return 'left';
        if (prev === 'right') return 'front';
        if (prev === 'left') return 'right';
      }
      return prev;
    });
  }, [isTransitioning]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        rotate('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        rotate('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rotate]);

  // Canvas setup for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Redraw canvas when strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // Render current drawing strokes
    const allStrokes = [...strokes, currentStroke].filter(s => s.length >= 2);
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

    renderGraffitiStrokes(ctx, graffitiToRender, canvas.clientWidth, canvas.clientHeight);
  }, [strokes, currentStroke, implement, facing]);

  // Drawing handlers
  const getPointFromEvent = useCallback((clientX: number, clientY: number): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, []);

  const handleDrawStart = useCallback((clientX: number, clientY: number) => {
    const point = getPointFromEvent(clientX, clientY);
    if (!point) return;

    setIsDrawing(true);
    setCurrentStroke([point]);
    lastPointRef.current = { x: point.x, y: point.y, time: Date.now() };
  }, [getPointFromEvent]);

  const handleDrawMove = useCallback((clientX: number, clientY: number) => {
    if (!isDrawing) return;

    const point = getPointFromEvent(clientX, clientY);
    if (!point) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
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
  }, [isDrawing, implement, getPointFromEvent]);

  const handleDrawEnd = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    if (currentStroke.length >= 2) {
      const newStrokes = [...strokes, currentStroke];
      setStrokes(newStrokes);

      // Auto-submit the drawing
      onSubmit(facing, newStrokes, implement);

      // Clear strokes after submission
      setStrokes([]);
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  }, [isDrawing, currentStroke, strokes, facing, implement, onSubmit]);

  // Touch/swipe handlers - need to distinguish between swipe and draw
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;

    // Start drawing immediately
    handleDrawStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleDrawMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX.current;
    const threshold = 50;

    // Only rotate if it was a swipe (and not a draw)
    if (!isDrawing && Math.abs(diff) > threshold && !isTransitioning) {
      rotate(diff > 0 ? 'left' : 'right');
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

  const targetRotation = FACING_TO_ROTATION[facing];

  return (
    <div
      className="relative w-full h-full bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        camera={{
          fov: fov,
          near: 0.1,
          far: 100,
          position: [0, cameraY, 0]
        }}
        gl={{ antialias: true }}
      >
        <CameraController
          targetRotation={targetRotation}
          isTransitioning={isTransitioning}
          setIsTransitioning={setIsTransitioning}
          cameraY={cameraY}
          fov={fov}
        />

        {/* Ambient lighting - brighten to see floor gap clearly */}
        <ambientLight intensity={0.9} />

        {/* Directional light from above (fluorescent) */}
        <directionalLight position={[0, 2, 0]} intensity={0.4} />

        {/* Subtle light from below to show floor continues under walls */}
        <directionalLight position={[0, -1, 0]} intensity={0.15} color="#f0e8d8" />

        <StallGeometry
          graffiti={graffiti}
          wallDistance={wallDistance}
          wallHeight={wallHeight}
        />
      </Canvas>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
          <div className="text-[#999] text-sm">
            Loading graffiti...
          </div>
        </div>
      )}

      {/* UI Overlay */}
      <div
        className="absolute inset-0 pointer-events-none flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drawing canvas overlay - positioned above 3D canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-auto touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Navigation arrows - hide left arrow at left wall, hide right arrow at right wall */}
        {facing !== 'left' && (
          <button
            onClick={() => rotate('left')}
            disabled={isTransitioning}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white/80 transition-colors pointer-events-auto disabled:opacity-30"
            aria-label="Look left"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {facing !== 'right' && (
          <button
            onClick={() => rotate('right')}
            disabled={isTransitioning}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white/80 transition-colors pointer-events-auto disabled:opacity-30"
            aria-label="Look right"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Implement picker at bottom - always visible */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <ImplementPicker selected={implement} onChange={setImplement} />
        </div>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div className="absolute top-4 right-4 bg-black/90 text-white p-4 rounded text-xs font-mono z-50 w-64 select-text">
          <div className="mb-3 text-sm font-bold border-b border-white/20 pb-2">
            Debug Controls (press ` to hide)
          </div>

          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-white/70">
                FOV: {fov}°
              </label>
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
              Facing: {facing}<br/>
              Camera at (0, {cameraY.toFixed(2)}, 0)<br/>
              Front wall at Z=-{wallDistance.toFixed(1)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
