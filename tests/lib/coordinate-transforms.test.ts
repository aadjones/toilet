/**
 * Tests for coordinate transformation utilities.
 * These are core algorithmic functions that must work correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  transformStrokeForWall,
  validateStrokeCoordinates,
  normalizedToPixels,
} from '@/lib/coordinate-transforms';

// NOTE: screenToNormalized tests skipped - it's a thin wrapper around browser APIs (DOMRect)
// that's hard to test in Node. The real value is in testing the transformation logic below.

describe('transformStrokeForWall', () => {
  const stroke = [
    { x: 0.2, y: 0.3 },
    { x: 0.5, y: 0.6 },
    { x: 0.8, y: 0.9 },
  ];

  it('does not transform front wall coordinates', () => {
    const result = transformStrokeForWall(stroke, 'front');

    expect(result).toEqual(stroke);
  });

  it('flips X coordinates for left wall', () => {
    const result = transformStrokeForWall(stroke, 'left');

    // Use toBeCloseTo for floating point comparison
    expect(result[0].x).toBeCloseTo(0.8, 10);
    expect(result[0].y).toBe(0.3);
    expect(result[1].x).toBeCloseTo(0.5, 10);
    expect(result[1].y).toBe(0.6);
    expect(result[2].x).toBeCloseTo(0.2, 10);
    expect(result[2].y).toBe(0.9);
  });

  it('flips X coordinates for right wall', () => {
    const result = transformStrokeForWall(stroke, 'right');

    // Use toBeCloseTo for floating point comparison
    expect(result[0].x).toBeCloseTo(0.8, 10);
    expect(result[0].y).toBe(0.3);
    expect(result[1].x).toBeCloseTo(0.5, 10);
    expect(result[1].y).toBe(0.6);
    expect(result[2].x).toBeCloseTo(0.2, 10);
    expect(result[2].y).toBe(0.9);
  });

  it('preserves Y coordinates for side walls', () => {
    const leftResult = transformStrokeForWall(stroke, 'left');
    const rightResult = transformStrokeForWall(stroke, 'right');

    leftResult.forEach((point, i) => {
      expect(point.y).toBe(stroke[i].y);
    });
    rightResult.forEach((point, i) => {
      expect(point.y).toBe(stroke[i].y);
    });
  });

  it('handles edge case: x=0 becomes x=1 for side walls', () => {
    const edgeStroke = [{ x: 0, y: 0.5 }];
    const result = transformStrokeForWall(edgeStroke, 'left');

    expect(result).toEqual([{ x: 1, y: 0.5 }]);
  });

  it('handles edge case: x=1 becomes x=0 for side walls', () => {
    const edgeStroke = [{ x: 1, y: 0.5 }];
    const result = transformStrokeForWall(edgeStroke, 'left');

    expect(result).toEqual([{ x: 0, y: 0.5 }]);
  });
});

describe('validateStrokeCoordinates', () => {
  it('accepts valid stroke with coordinates in range [0, 1]', () => {
    const validStroke = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];

    expect(validateStrokeCoordinates(validStroke)).toBe(true);
  });

  it('rejects stroke with negative X coordinate', () => {
    const invalidStroke = [
      { x: -0.1, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];

    expect(validateStrokeCoordinates(invalidStroke)).toBe(false);
  });

  it('rejects stroke with X coordinate > 1', () => {
    const invalidStroke = [
      { x: 1.1, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];

    expect(validateStrokeCoordinates(invalidStroke)).toBe(false);
  });

  it('rejects stroke with negative Y coordinate', () => {
    const invalidStroke = [
      { x: 0.5, y: -0.1 },
      { x: 0.5, y: 0.5 },
    ];

    expect(validateStrokeCoordinates(invalidStroke)).toBe(false);
  });

  it('rejects stroke with Y coordinate > 1', () => {
    const invalidStroke = [
      { x: 0.5, y: 1.1 },
      { x: 0.5, y: 0.5 },
    ];

    expect(validateStrokeCoordinates(invalidStroke)).toBe(false);
  });

  it('accepts empty stroke', () => {
    expect(validateStrokeCoordinates([])).toBe(true);
  });

  it('accepts single-point stroke', () => {
    const singlePoint = [{ x: 0.5, y: 0.5 }];

    expect(validateStrokeCoordinates(singlePoint)).toBe(true);
  });
});

describe('normalizedToPixels', () => {
  it('converts (0.5, 0.5) to center of canvas', () => {
    const result = normalizedToPixels({ x: 0.5, y: 0.5 }, 800, 600);

    expect(result).toEqual({ x: 400, y: 300 });
  });

  it('converts (0, 0) to top-left corner', () => {
    const result = normalizedToPixels({ x: 0, y: 0 }, 800, 600);

    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('converts (1, 1) to bottom-right corner', () => {
    const result = normalizedToPixels({ x: 1, y: 1 }, 800, 600);

    expect(result).toEqual({ x: 800, y: 600 });
  });

  it('handles non-square canvas correctly', () => {
    const result = normalizedToPixels({ x: 0.5, y: 0.5 }, 1920, 1080);

    expect(result).toEqual({ x: 960, y: 540 });
  });

  it('maintains precision for fractional coordinates', () => {
    const result = normalizedToPixels({ x: 0.333, y: 0.666 }, 900, 600);

    expect(result.x).toBeCloseTo(299.7, 1);
    expect(result.y).toBeCloseTo(399.6, 1);
  });
});
