import { type Graffiti, type ImplementType, IMPLEMENT_STYLES } from './config';

/**
 * Simple seeded random number generator for consistent scribble wobble.
 * Returns a value between 0 and 1.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Renders graffiti strokes onto a canvas context.
 * This is the single source of truth for how graffiti appears visually.
 * Used by both StallView3D (texture generation) and DrawingMode (live preview).
 */
export function renderGraffitiStrokes(
  ctx: CanvasRenderingContext2D,
  graffiti: Graffiti[],
  width: number,
  height: number
): void {
  graffiti.forEach((g, graffitiIndex) => {
    const style = IMPLEMENT_STYLES[g.implement as ImplementType];

    ctx.strokeStyle = g.color;
    ctx.lineWidth = style.lineWidth;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;
    ctx.globalAlpha = g.opacity;

    // Apply shadow for depth (marker and carved)
    ctx.shadowBlur = style.shadowBlur;
    ctx.shadowColor = style.shadowColor;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (g.implement === 'carved') {
      ctx.setLineDash([2, 1]);
    } else {
      ctx.setLineDash([]);
    }

    g.strokeData.forEach((stroke, strokeIndex) => {
      if (stroke.length < 2) return;

      // DEBUG: Only log for texture canvas, not preview
      if (graffitiIndex === graffiti.length - 1 && strokeIndex === 0 && width !== 480) {
        console.log('=== TEXTURE RENDERING ===');
        console.log('Texture dimensions:', width, 'x', height);
        console.log('First point (pixels):', { x: stroke[0].x * width, y: stroke[0].y * height });
        console.log('Last point (pixels):', { x: stroke[stroke.length - 1].x * width, y: stroke[stroke.length - 1].y * height });
      }

      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);

      for (let i = 1; i < stroke.length; i++) {
        const x = stroke[i].x * width;
        const y = stroke[i].y * height;

        if (g.implement === 'scribble') {
          // Use seeded random based on graffiti ID and point index for consistency
          const seed = (g.id.charCodeAt(0) || 0) * 1000 + strokeIndex * 100 + i;
          const wobble = (seededRandom(seed) - 0.5) * 1;
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
