/**
 * Velocity gating logic for the "carved" drawing implement.
 * Carved mode requires slow, deliberate strokes - fast movements are rejected.
 */

import { type StrokePoint, CARVE_VELOCITY_THRESHOLD } from './config';

/**
 * Represents a point with timing information for velocity calculation.
 */
export interface TimedPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Checks if a new stroke point should be accepted based on velocity.
 * Used for "carved" mode to enforce slow, deliberate drawing.
 *
 * Algorithm:
 * 1. Calculate pixel distance between last point and new point
 * 2. Calculate time elapsed
 * 3. Calculate velocity (pixels per millisecond)
 * 4. Reject if velocity exceeds threshold
 *
 * This creates the physical constraint of "carving" - you can't rush it.
 *
 * @param lastPoint - Previous point with timestamp
 * @param newPoint - New point to validate (normalized 0-1 coordinates)
 * @param canvasWidth - Canvas width in pixels (for distance calculation)
 * @param canvasHeight - Canvas height in pixels (for distance calculation)
 * @param velocityThreshold - Maximum allowed velocity (pixels/ms), defaults to CARVE_VELOCITY_THRESHOLD
 * @returns True if point should be accepted, false if too fast
 */
export function shouldAcceptPoint(
  lastPoint: TimedPoint,
  newPoint: StrokePoint,
  canvasWidth: number,
  canvasHeight: number,
  velocityThreshold: number = CARVE_VELOCITY_THRESHOLD
): boolean {
  const now = Date.now();
  const timeDelta = now - lastPoint.time;

  // Always accept if no time has passed (prevents division by zero)
  if (timeDelta === 0) {
    return true;
  }

  // Calculate pixel distance
  const dx = (newPoint.x - lastPoint.x) * canvasWidth;
  const dy = (newPoint.y - lastPoint.y) * canvasHeight;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Calculate velocity in pixels per millisecond
  const velocity = distance / timeDelta;

  // Accept if slow enough
  return velocity <= velocityThreshold;
}

/**
 * Creates a timed point from a stroke point.
 * Convenience function for initializing velocity tracking.
 *
 * @param point - Normalized stroke point
 * @param time - Timestamp (defaults to current time)
 * @returns Timed point ready for velocity calculations
 */
export function createTimedPoint(
  point: StrokePoint,
  time: number = Date.now()
): TimedPoint {
  return {
    x: point.x,
    y: point.y,
    time,
  };
}

/**
 * Calculates the actual velocity of a stroke segment.
 * Useful for debugging or analytics.
 *
 * @param lastPoint - Previous point with timestamp
 * @param newPoint - New point (normalized 0-1 coordinates)
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @returns Velocity in pixels per millisecond
 */
export function calculateVelocity(
  lastPoint: TimedPoint,
  newPoint: StrokePoint,
  canvasWidth: number,
  canvasHeight: number
): number {
  const now = Date.now();
  const timeDelta = now - lastPoint.time;

  if (timeDelta === 0) {
    return 0;
  }

  const dx = (newPoint.x - lastPoint.x) * canvasWidth;
  const dy = (newPoint.y - lastPoint.y) * canvasHeight;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance / timeDelta;
}
