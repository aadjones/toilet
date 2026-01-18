"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { type FacingDirection, FACING_TO_ROTATION } from "@/lib/geometry";
import { trackEvent } from "@/lib/analytics";

interface UseCameraOptions {
  initialFacing?: FacingDirection;
  cameraY?: number;
  fov?: number;
}

interface UseCameraReturn {
  facing: FacingDirection;
  isTransitioning: boolean;
  rotate: (direction: "left" | "right") => void;
  targetRotation: number;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  setIsTransitioning: (v: boolean) => void;
}

/**
 * Hook for managing camera rotation between walls
 */
export function useCamera({
  initialFacing = "front",
  cameraY = 0.25,
  fov = 72,
}: UseCameraOptions = {}): UseCameraReturn {
  const [facing, setFacing] = useState<FacingDirection>(initialFacing);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cameraRef = useRef<THREE.Camera | null>(null);

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
          trackEvent("wall_rotation", { from: prev, to: newFacing });
        }

        return newFacing;
      });
    },
    [isTransitioning]
  );

  // Keyboard controls for arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
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

  const targetRotation = FACING_TO_ROTATION[facing];

  return {
    facing,
    isTransitioning,
    rotate,
    targetRotation,
    cameraRef,
    setIsTransitioning,
  };
}

interface CameraControllerProps {
  targetRotation: number;
  isTransitioning: boolean;
  setIsTransitioning: (v: boolean) => void;
  cameraY: number;
  fov: number;
  onCameraReady?: (camera: THREE.Camera) => void;
}

/**
 * Three.js component that handles camera animation
 * Must be used inside a Canvas component
 */
export function CameraController({
  targetRotation,
  isTransitioning,
  setIsTransitioning,
  cameraY,
  fov,
  onCameraReady,
}: CameraControllerProps) {
  const { camera } = useThree();
  const currentRotation = useRef(targetRotation);
  const initialized = useRef(false);

  // Initialize camera on mount
  useEffect(() => {
    if (!initialized.current) {
      // Position camera back in the stall (positive Z) looking forward
      camera.position.set(0, cameraY, 1.2);
      camera.rotation.set(0, 0, 0);
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

      const speed = 5.3;
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
