import { type Graffiti, type ImplementType, IMPLEMENT_STYLES } from './config';

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
  graffiti.forEach((g) => {
    const style = IMPLEMENT_STYLES[g.implement as ImplementType];

    ctx.strokeStyle = g.color;
    ctx.lineWidth = style.lineWidth;
    ctx.lineCap = style.lineCap;
    ctx.lineJoin = style.lineJoin;
    ctx.globalAlpha = g.opacity;

    if (g.implement === 'carved') {
      ctx.setLineDash([2, 1]);
    } else {
      ctx.setLineDash([]);
    }

    g.strokeData.forEach((stroke) => {
      if (stroke.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);

      for (let i = 1; i < stroke.length; i++) {
        const x = stroke[i].x * width;
        const y = stroke[i].y * height;

        if (g.implement === 'scribble') {
          const wobble = (Math.random() - 0.5) * 1;
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
