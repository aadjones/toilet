import { type Graffiti, type ImplementType, IMPLEMENT_STYLES } from './config';

/**
 * Simple seeded random number generator for consistent scribble wobble.
 * Returns a value between 0 and 1.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Reference width for line width calibration
// Line widths in IMPLEMENT_STYLES are calibrated for this canvas width
export const LINE_WIDTH_REFERENCE = 480;

/**
 * Renders graffiti strokes onto a canvas context.
 * This is the single source of truth for how graffiti appears visually.
 * Used by StallView3D for both texture generation and live preview.
 *
 * @param lineWidthScale - Optional scale factor for line widths. If not provided,
 *                         line widths are scaled proportionally to canvas width
 *                         relative to LINE_WIDTH_REFERENCE (480px).
 */
export function renderGraffitiStrokes(
  ctx: CanvasRenderingContext2D,
  graffiti: Graffiti[],
  width: number,
  height: number,
  lineWidthScale?: number
): void {
  // Scale line widths proportionally to canvas size if no explicit scale provided
  const scale = lineWidthScale ?? (width / LINE_WIDTH_REFERENCE);
  graffiti.forEach((g) => {
    const style = IMPLEMENT_STYLES[g.implement as ImplementType];

    ctx.strokeStyle = g.color;
    ctx.lineWidth = style.lineWidth * scale;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;
    ctx.globalAlpha = g.opacity;

    // Apply shadow for depth (marker and carved) - scale with line width
    ctx.shadowBlur = style.shadowBlur * scale;
    ctx.shadowColor = style.shadowColor;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (g.implement === 'carved') {
      ctx.setLineDash([2 * scale, 1 * scale]);
    } else {
      ctx.setLineDash([]);
    }

    g.strokeData.forEach((stroke, strokeIndex) => {
      if (stroke.length < 1) return;

      // Handle single-point strokes as filled dots (except for carved - can't tap-carve!)
      if (stroke.length === 1) {
        if (g.implement === 'carved') {
          // Skip carved tap dots - you can't tap-carve into a hard surface
          return;
        }

        const x = stroke[0].x * width;
        const y = stroke[0].y * height;
        const radius = (style.lineWidth * scale) / 2;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = g.color;
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);

      for (let i = 1; i < stroke.length; i++) {
        const x = stroke[i].x * width;
        const y = stroke[i].y * height;

        if (g.implement === 'scribble') {
          // Use seeded random based on graffiti ID and point index for consistency
          const seed = (g.id.charCodeAt(0) || 0) * 1000 + strokeIndex * 100 + i;
          const wobble = (seededRandom(seed) - 0.5) * scale;
          ctx.lineTo(x + wobble, y + wobble);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    });
  });

  // Reset context state
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

/**
 * Calculates opacity for graffiti based on age and implement type.
 * Carved graffiti never fades (opacity = 1.0).
 * Other implements fade from 1.0 to 0.3 over their lifespan.
 */
export function calculateOpacity(
  createdAt: string | number,
  expiresAt: string | number,
  implement: ImplementType
): number {
  if (implement === 'carved') {
    return 1.0;
  }

  const now = Date.now();
  const created = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
  const expires = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt;

  const lifespan = expires - created;
  const age = now - created;
  const progress = Math.min(age / lifespan, 1);

  // Fade from 1.0 to 0.3
  return 1.0 - (progress * 0.7);
}
