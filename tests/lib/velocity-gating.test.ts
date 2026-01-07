/**
 * Tests for velocity gating logic (carved mode).
 * This is a core game mechanic - slow strokes are accepted, fast strokes are rejected.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldAcceptPoint,
  createTimedPoint,
  calculateVelocity,
} from '@/lib/velocity-gating';
import { CARVE_VELOCITY_THRESHOLD } from '@/lib/config';

describe('shouldAcceptPoint', () => {
  const canvasWidth = 800;
  const canvasHeight = 600;

  it('accepts point with zero velocity (no time elapsed)', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now };
    const newPoint = { x: 0.5, y: 0.5 }; // Same position

    const result = shouldAcceptPoint(lastPoint, newPoint, canvasWidth, canvasHeight);

    expect(result).toBe(true);
  });

  it('accepts slow movement (under threshold)', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 100 }; // 100ms ago
    // Move 10 pixels over 100ms = 0.1 pixels/ms (well under threshold)
    const newPoint = { x: 0.5125, y: 0.5 }; // 0.0125 * 800 = 10 pixels right

    const result = shouldAcceptPoint(lastPoint, newPoint, canvasWidth, canvasHeight);

    expect(result).toBe(true);
  });

  it('rejects fast movement (over threshold)', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 10 }; // 10ms ago
    // Move 200 pixels over 10ms = 20 pixels/ms (way over threshold)
    const newPoint = { x: 0.75, y: 0.5 }; // 0.25 * 800 = 200 pixels right

    const result = shouldAcceptPoint(lastPoint, newPoint, canvasWidth, canvasHeight);

    expect(result).toBe(false);
  });

  it('handles diagonal movement correctly', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 50 }; // 50ms ago
    // Move diagonally: sqrt((40)^2 + (30)^2) = 50 pixels over 50ms = 1 pixel/ms
    const newPoint = { x: 0.55, y: 0.55 }; // 40px right, 30px down

    const result = shouldAcceptPoint(lastPoint, newPoint, canvasWidth, canvasHeight);

    // This should be close to threshold - test both ways to be safe
    if (1.0 <= CARVE_VELOCITY_THRESHOLD) {
      expect(result).toBe(true);
    } else {
      expect(result).toBe(false);
    }
  });

  it('respects custom velocity threshold', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 100 };
    const newPoint = { x: 0.6, y: 0.5 }; // 80 pixels over 100ms = 0.8 px/ms

    // Should reject with strict threshold
    const strictResult = shouldAcceptPoint(
      lastPoint,
      newPoint,
      canvasWidth,
      canvasHeight,
      0.5 // 0.5 px/ms threshold
    );
    expect(strictResult).toBe(false);

    // Should accept with lenient threshold
    const lenientResult = shouldAcceptPoint(
      lastPoint,
      newPoint,
      canvasWidth,
      canvasHeight,
      1.0 // 1.0 px/ms threshold
    );
    expect(lenientResult).toBe(true);
  });

  it('accounts for canvas dimensions in distance calculation', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 100 };
    const newPoint = { x: 0.6, y: 0.5 }; // 10% of width

    // Same normalized movement, different pixel distances
    const smallCanvas = shouldAcceptPoint(lastPoint, newPoint, 100, 100);
    const largeCanvas = shouldAcceptPoint(lastPoint, newPoint, 1000, 1000);

    // Large canvas = more pixels = higher velocity = more likely to reject
    // Small canvas = fewer pixels = lower velocity = more likely to accept
    expect(smallCanvas).toBe(true); // 10px over 100ms = 0.1 px/ms (should accept)

    // This might be accepted or rejected depending on threshold
    // Just verify it's calculated differently
    const smallVelocity = calculateVelocity(lastPoint, newPoint, 100, 100);
    const largeVelocity = calculateVelocity(lastPoint, newPoint, 1000, 1000);
    expect(largeVelocity).toBeGreaterThan(smallVelocity);
  });
});

describe('createTimedPoint', () => {
  it('creates timed point with current timestamp', () => {
    const before = Date.now();
    const point = createTimedPoint({ x: 0.5, y: 0.7 });
    const after = Date.now();

    expect(point.x).toBe(0.5);
    expect(point.y).toBe(0.7);
    expect(point.time).toBeGreaterThanOrEqual(before);
    expect(point.time).toBeLessThanOrEqual(after);
  });

  it('creates timed point with custom timestamp', () => {
    const customTime = 1234567890;
    const point = createTimedPoint({ x: 0.3, y: 0.8 }, customTime);

    expect(point.x).toBe(0.3);
    expect(point.y).toBe(0.8);
    expect(point.time).toBe(customTime);
  });
});

describe('calculateVelocity', () => {
  const canvasWidth = 800;
  const canvasHeight = 600;

  it('returns 0 for zero time delta', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now };
    const newPoint = { x: 0.6, y: 0.6 };

    const velocity = calculateVelocity(lastPoint, newPoint, canvasWidth, canvasHeight);

    expect(velocity).toBe(0);
  });

  it('calculates velocity for horizontal movement', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 100 }; // 100ms ago
    const newPoint = { x: 0.6, y: 0.5 }; // 80 pixels right (0.1 * 800)

    const velocity = calculateVelocity(lastPoint, newPoint, canvasWidth, canvasHeight);

    expect(velocity).toBeCloseTo(0.8, 2); // 80px / 100ms = 0.8 px/ms
  });

  it('calculates velocity for vertical movement', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 50 }; // 50ms ago
    const newPoint = { x: 0.5, y: 0.6 }; // 60 pixels down (0.1 * 600)

    const velocity = calculateVelocity(lastPoint, newPoint, canvasWidth, canvasHeight);

    expect(velocity).toBeCloseTo(1.2, 2); // 60px / 50ms = 1.2 px/ms
  });

  it('calculates velocity for diagonal movement', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 100 };
    // Move right 80px, down 60px
    const newPoint = { x: 0.6, y: 0.6 };

    const velocity = calculateVelocity(lastPoint, newPoint, canvasWidth, canvasHeight);

    // Distance = sqrt(80^2 + 60^2) = sqrt(6400 + 3600) = 100px
    // Velocity = 100px / 100ms = 1.0 px/ms
    expect(velocity).toBeCloseTo(1.0, 2);
  });

  it('handles very slow movement', () => {
    const now = Date.now();
    const lastPoint = { x: 0.5, y: 0.5, time: now - 1000 }; // 1 second ago
    const newPoint = { x: 0.505, y: 0.5 }; // 4 pixels (0.005 * 800)

    const velocity = calculateVelocity(lastPoint, newPoint, canvasWidth, canvasHeight);

    expect(velocity).toBeCloseTo(0.004, 3); // 4px / 1000ms = 0.004 px/ms
  });

  it('handles very fast movement', () => {
    const now = Date.now();
    const lastPoint = { x: 0, y: 0, time: now - 1 }; // 1ms ago
    const newPoint = { x: 1, y: 1 }; // Full diagonal (800px, 600px)

    const velocity = calculateVelocity(lastPoint, newPoint, canvasWidth, canvasHeight);

    // Distance = sqrt(800^2 + 600^2) = 1000px
    // Velocity = 1000px / 1ms = 1000 px/ms
    expect(velocity).toBeCloseTo(1000, 1);
  });
});

describe('velocity gating integration', () => {
  it('should enforce carving behavior: accept slow, reject fast', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;

    // Simulate a slow, deliberate carving stroke
    let lastPoint = createTimedPoint({ x: 0.2, y: 0.2 });

    // Move slowly over time (should accept all points)
    const slowPoints = [
      { x: 0.21, y: 0.21, delay: 100 }, // Small move, 100ms
      { x: 0.22, y: 0.22, delay: 100 },
      { x: 0.23, y: 0.23, delay: 100 },
    ];

    slowPoints.forEach(({ x, y, delay }) => {
      lastPoint = { ...lastPoint, time: lastPoint.time - delay };
      const newPoint = { x, y };
      const accepted = shouldAcceptPoint(lastPoint, newPoint, canvasWidth, canvasHeight);
      expect(accepted).toBe(true);
      lastPoint = createTimedPoint(newPoint);
    });

    // Now try a fast movement (should reject)
    lastPoint = { ...lastPoint, time: lastPoint.time - 10 }; // Only 10ms
    const fastPoint = { x: 0.5, y: 0.5 }; // Big jump
    const acceptedFast = shouldAcceptPoint(lastPoint, fastPoint, canvasWidth, canvasHeight);
    expect(acceptedFast).toBe(false);
  });
});
