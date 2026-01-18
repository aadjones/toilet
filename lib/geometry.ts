import * as THREE from "three";
import { type StrokePoint, type Stroke } from "@/lib/config";

export type FacingDirection = "front" | "left" | "right";

// Stall geometry constants - shared between components
export const STALL_CONSTANTS = {
  stallDepth: 2.4,
  backZ: 1.8,
  get frontZ() {
    return this.backZ - this.stallDepth;
  },
  floorGap: 0.09, // American-style stall gap at bottom
};

// Convert facing direction to camera rotation (Y-axis radians)
export const FACING_TO_ROTATION: Record<FacingDirection, number> = {
  front: 0,
  left: Math.PI / 2, // 90 degrees left
  right: -Math.PI / 2, // 90 degrees right
};

/**
 * Check if a point is near a stroke (within threshold distance)
 * Used for selecting graffiti by clicking near it
 */
export function isPointNearStroke(
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

export interface WallBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate screen-space bounding box of a wall based on facing direction
 * Projects 3D wall corners to 2D screen coordinates
 */
export function calculateWallBounds(
  camera: THREE.Camera,
  canvasWidth: number,
  canvasHeight: number,
  wallDistance: number,
  wallHeight: number,
  facing: FacingDirection
): WallBounds | null {
  if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return null;

  const perspectiveCamera = camera as THREE.PerspectiveCamera;

  // Wall geometry matches StallGeometry component
  const stallWidth = wallDistance * 2;
  const { floorGap, stallDepth, backZ } = STALL_CONSTANTS;
  const frontZ = backZ - stallDepth;
  const adjustedWallHeight = wallHeight - floorGap;
  const wallCenterY = floorGap / 2;

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
