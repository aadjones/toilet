"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { type Graffiti, type WallType } from "@/lib/config";
import {
  createWallTexture,
  createDoorTexture,
  createFloorTexture,
  createCeilingTexture,
} from "@/lib/texture-generation";
import { STALL_CONSTANTS } from "@/lib/geometry";

interface StallGeometryProps {
  graffiti: Record<WallType, Graffiti[]>;
  wallDistance?: number;
  wallHeight?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * The 3D geometry for the bathroom stall
 * Renders walls, floor, ceiling with graffiti textures
 */
export function StallGeometry({
  graffiti,
  wallDistance = 0.5,
  wallHeight = 2.0,
  canvasWidth = 480,
  canvasHeight = 736,
}: StallGeometryProps) {
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
  const { stallDepth, backZ, floorGap } = STALL_CONSTANTS;
  const frontZ = backZ - stallDepth;
  const stallWidth = wallDistance * 2;

  // Extended dimensions to fill viewport without black gaps
  const extendedFloorWidth = stallWidth * 3;
  const extendedFloorDepth = stallDepth * 2;

  // American-style stall partition: walls don't touch the floor
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
