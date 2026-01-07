/**
 * Coordinate transformation utilities for converting between screen space,
 * normalized coordinates, and wall-specific coordinate systems.
 */

import { type StrokePoint, type WallType } from './config';

/**
 * Converts screen pixel coordinates to normalized coordinates (0-1 range).
 * Used for converting mouse/touch events to wall-relative positions.
 *
 * @param clientX - Screen X coordinate from mouse/touch event
 * @param clientY - Screen Y coordinate from mouse/touch event
 * @param rect - DOMRect of the canvas element
 * @returns Normalized coordinates {x: 0-1, y: 0-1}, or null if invalid
 */
export function screenToNormalized(
  clientX: number,
  clientY: number,
  rect: DOMRect
): StrokePoint | null {
  if (!rect || rect.width === 0 || rect.height === 0) {
    return null;
  }

  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

/**
 * Transforms stroke coordinates based on wall type.
 * Side walls (left/right) need X-axis flipping because of how the 3D geometry
 * maps texture coordinates.
 *
 * Context: When the camera rotates to face left/right walls, the texture UV
 * mapping is mirrored. Drawing on the left edge of the screen should appear
 * on the left edge of the wall in 3D space, but the texture coordinates are
 * reversed. This function corrects that.
 *
 * @param stroke - Array of normalized coordinates from drawing
 * @param wall - Which wall the stroke is on ('front', 'left', or 'right')
 * @returns Transformed stroke with corrected coordinates
 */
export function transformStrokeForWall(
  stroke: StrokePoint[],
  wall: WallType
): StrokePoint[] {
  // Front wall: no transformation needed (1:1 mapping)
  if (wall === 'front') {
    return stroke;
  }

  // Side walls: flip X coordinates (1 - x) to match 3D geometry
  // This accounts for texture UV mapping on rotated planes
  return stroke.map(point => ({
    x: 1 - point.x,
    y: point.y
  }));
}

/**
 * Validates that stroke coordinates are within valid bounds.
 * Coordinates should be in the range [0, 1].
 *
 * @param stroke - Array of stroke points to validate
 * @returns True if all points are valid, false otherwise
 */
export function validateStrokeCoordinates(stroke: StrokePoint[]): boolean {
  return stroke.every(point =>
    point.x >= 0 && point.x <= 1 &&
    point.y >= 0 && point.y <= 1
  );
}

/**
 * Converts normalized coordinates back to pixel coordinates for rendering.
 * Used when drawing strokes onto a canvas texture.
 *
 * @param point - Normalized coordinate (0-1 range)
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns Pixel coordinates
 */
export function normalizedToPixels(
  point: StrokePoint,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: point.x * width,
    y: point.y * height,
  };
}
