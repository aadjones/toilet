"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  type Stroke,
  type ImplementType,
  type WallType,
  type Graffiti,
} from "@/lib/config";
import { ImplementPicker } from "./ImplementPicker";
import { StallGeometry } from "./StallGeometry";
import { DebugPanel } from "./DebugPanel";
import { useCamera, CameraController } from "@/lib/hooks/useCamera";
import { useGraffiti } from "@/lib/hooks/useGraffiti";
import { useDrawing } from "@/lib/hooks/useDrawing";
import { trackEvent } from "@/lib/analytics";
import { HEADER_MESSAGES } from "@/lib/header-messages";

interface StallView3DProps {
  onSubmit: (
    wall: WallType,
    strokeData: Stroke[],
    implement: ImplementType
  ) => void;
  stallRef?: React.MutableRefObject<{
    addLocalGraffiti: (wall: WallType, graffiti: Graffiti) => void;
    getWallGraffiti: (wall: WallType) => Graffiti[];
  } | null>;
  debugUnlimitedPosting?: boolean;
  onDebugUnlimitedPostingChange?: (enabled: boolean) => void;
}

export function StallView3D({
  onSubmit,
  stallRef,
  debugUnlimitedPosting = false,
  onDebugUnlimitedPostingChange,
}: StallView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  // Debug panel settings
  const [showDebug, setShowDebug] = useState(false);
  const [fov, setFov] = useState(72);
  const [cameraY, setCameraY] = useState(0.25);
  const [wallDistance, setWallDistance] = useState(0.5);
  const [wallHeight, setWallHeight] = useState(2.0);
  const [selectorMode, setSelectorMode] = useState(false);
  const [selectedGraffiti, setSelectedGraffiti] = useState<Graffiti[]>([]);

  // Random header message on mount
  const [headerMessage, setHeaderMessage] = useState<string>(HEADER_MESSAGES[0]);

  // Desktop detection for custom cursors
  const [isDesktop, setIsDesktop] = useState(false);

  // Set random message and track session on mount
  useEffect(() => {
    setHeaderMessage(
      HEADER_MESSAGES[Math.floor(Math.random() * HEADER_MESSAGES.length)]
    );
    trackEvent("session_start");
  }, []);

  // Detect if we're on a desktop (non-touch) device for custom cursors
  useEffect(() => {
    const checkDesktop = () => {
      const hasFineMouse = window.matchMedia("(pointer: fine)").matches;
      setIsDesktop(hasFineMouse);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Keyboard shortcut for debug panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "`") {
        e.preventDefault();
        setShowDebug((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Use extracted hooks
  const {
    facing,
    isTransitioning,
    rotate,
    targetRotation,
    cameraRef,
    setIsTransitioning,
  } = useCamera({ cameraY, fov });

  const {
    graffiti,
    isLoading,
    addLocalGraffiti,
    deleteGraffiti,
    clearAllGraffiti,
    getWallGraffiti,
  } = useGraffiti();

  const {
    implement,
    setImplement,
    isDrawing,
    canvasRef,
    canvasDimensions,
    handleDrawStart,
    handleDrawMove,
    handleDrawEnd,
  } = useDrawing({
    facing,
    wallDistance,
    wallHeight,
    cameraRef,
    graffiti,
    onSubmit,
    selectorMode,
    onSelectGraffiti: setSelectedGraffiti,
  });

  // Expose methods via ref
  useEffect(() => {
    if (stallRef) {
      stallRef.current = { addLocalGraffiti, getWallGraffiti };
    }
  }, [addLocalGraffiti, getWallGraffiti, stallRef]);

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
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

  // Touch event listeners with non-passive option
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

  // Handle graffiti deletion (also remove from selected list)
  const handleDeleteGraffiti = useCallback(
    async (id: string) => {
      await deleteGraffiti(id);
      setSelectedGraffiti((prev) => prev.filter((g) => g.id !== id));
    },
    [deleteGraffiti]
  );

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

        {/* Lighting */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[0, 2, 0]} intensity={0.4} />
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

        {/* Drawing canvas overlay */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-auto touch-none ${
            isDesktop ? `cursor-${implement}` : ""
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          role="img"
          aria-label={`Bathroom stall ${facing} wall - drawing canvas`}
        />

        {/* Navigation arrows */}
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

        {/* Implement picker */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <ImplementPicker selected={implement} onChange={setImplement} />
        </div>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <DebugPanel
          fov={fov}
          setFov={setFov}
          cameraY={cameraY}
          setCameraY={setCameraY}
          wallDistance={wallDistance}
          setWallDistance={setWallDistance}
          wallHeight={wallHeight}
          setWallHeight={setWallHeight}
          facing={facing}
          debugUnlimitedPosting={debugUnlimitedPosting}
          onDebugUnlimitedPostingChange={onDebugUnlimitedPostingChange}
          selectorMode={selectorMode}
          setSelectorMode={setSelectorMode}
          selectedGraffiti={selectedGraffiti}
          setSelectedGraffiti={setSelectedGraffiti}
          onDeleteGraffiti={handleDeleteGraffiti}
          onClearAllGraffiti={clearAllGraffiti}
        />
      )}
    </div>
  );
}
