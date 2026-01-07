/**
 * Texture generation utilities for bathroom stall walls, floor, and ceiling.
 * These are pure functions that take graffiti data and return Three.js textures.
 */

import * as THREE from 'three';
import { type Graffiti } from './config';
import { renderGraffitiStrokes, calculateOpacity } from './wall-rendering';

/**
 * Creates a texture for side partition walls (left/right walls).
 * Includes partition material, seams, mounting brackets, and optional toilet paper dispenser.
 *
 * @param graffiti - Array of graffiti to render on this wall
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param isLeftWall - Whether this is the left wall (affects dispenser placement)
 * @returns Three.js texture ready to apply to a mesh
 */
export function createWallTexture(
  graffiti: Graffiti[],
  width: number,
  height: number,
  isLeftWall: boolean = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Base partition color - powder-coated metal/laminate (warm greige)
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#ccc6b8');
  gradient.addColorStop(0.5, '#d4cec0');
  gradient.addColorStop(1, '#ccc6b8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Mottled/speckled texture (powder-coat appearance)
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 2 + 0.5;
    const isDark = Math.random() > 0.5;
    ctx.fillStyle = isDark ? '#b8b2a4' : '#e0dbd0';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Vertical manufacturing grain lines
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Vertical panel seams (partition panels)
  [0.33, 0.67].forEach(pos => {
    const x = width * pos;

    // Dark seam line
    ctx.strokeStyle = '#a8a298';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // U-channel highlight
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, 0);
    ctx.lineTo(x + 2, height);
    ctx.stroke();
  });

  // Edge darkening for depth
  const edgeGradientLeft = ctx.createLinearGradient(0, 0, 40, 0);
  edgeGradientLeft.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
  edgeGradientLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = edgeGradientLeft;
  ctx.fillRect(0, 0, 40, height);

  const edgeGradientRight = ctx.createLinearGradient(width - 40, 0, width, 0);
  edgeGradientRight.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edgeGradientRight.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = edgeGradientRight;
  ctx.fillRect(width - 40, 0, 40, height);

  // Mounting brackets at top
  [0.15, 0.85].forEach(pos => {
    const bracketX = width * pos;
    const bracketY = height * 0.05;

    // Bracket shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(bracketX - 12, bracketY, 24, 8);

    // Bracket body
    ctx.fillStyle = '#707070';
    ctx.fillRect(bracketX - 10, bracketY + 1, 20, 6);

    // Screw heads
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(bracketX - 6, bracketY + 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bracketX + 6, bracketY + 4, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Bottom shadow (gap from floor)
  const shadowGradient = ctx.createLinearGradient(0, height - 40, 0, height);
  shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = shadowGradient;
  ctx.fillRect(0, height - 40, width, 40);

  // Scuff marks near bottom
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#000';
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * width;
    const y = height - Math.random() * 80;
    const w = Math.random() * 25 + 8;
    ctx.fillRect(x, y, w, 1.5);
  }
  ctx.globalAlpha = 1;

  // Toilet paper dispenser (only on left wall)
  if (isLeftWall) {
    renderToiletPaperDispenser(ctx, width, height);
  }

  // Calculate opacity for each graffiti and render
  const graffitiWithOpacity = graffiti.map(g => ({
    ...g,
    opacity: calculateOpacity(g.createdAt, g.expiresAt, g.implement)
  }));

  renderGraffitiStrokes(ctx, graffitiWithOpacity, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Renders a toilet paper dispenser on the canvas.
 * Internal helper for wall texture generation.
 */
function renderToiletPaperDispenser(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  // When looking LEFT, texture coordinates are reversed:
  // Left edge (0%) = FRONT/door (Z=-0.6), Right edge (100%) = BACK (Z=1.8)
  // Camera at Z=1.2, which is close to the back
  // Need dispenser at ~25% (which maps to Z=1.2 from the camera position)
  const dispenserX = width * 0.25;  // 25% from left edge (near camera position)
  const dispenserY = height * 0.48; // 48% from top (mid-torso level when seated)
  const dispenserW = width * 0.12;
  const dispenserH = height * 0.08;

  // Dispenser shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(dispenserX - 2, dispenserY - 2, dispenserW + 4, dispenserH + 4);

  // Main dispenser body (light grey plastic)
  ctx.fillStyle = '#9a9a9a';
  ctx.beginPath();
  ctx.roundRect(dispenserX, dispenserY, dispenserW, dispenserH, 4);
  ctx.fill();

  // Darker frame/border
  ctx.strokeStyle = '#707070';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(dispenserX, dispenserY, dispenserW, dispenserH, 4);
  ctx.stroke();

  // Circular viewing window (showing partial roll)
  const windowCenterX = dispenserX + dispenserW * 0.5;
  const windowCenterY = dispenserY + dispenserH * 0.45;
  const windowRadius = dispenserH * 0.28;

  // Window dark background
  ctx.fillStyle = '#404040';
  ctx.beginPath();
  ctx.arc(windowCenterX, windowCenterY, windowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Partial toilet paper roll visible
  ctx.fillStyle = '#f8f8f8';
  ctx.beginPath();
  ctx.arc(windowCenterX, windowCenterY, windowRadius * 0.7, Math.PI * 0.3, Math.PI * 1.7);
  ctx.fill();

  // Roll core
  ctx.fillStyle = '#8b7355';
  ctx.beginPath();
  ctx.arc(windowCenterX, windowCenterY, windowRadius * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Keyhole at bottom center
  const keyholeX = dispenserX + dispenserW * 0.5;
  const keyholeY = dispenserY + dispenserH * 0.85;

  ctx.fillStyle = '#303030';
  ctx.beginPath();
  ctx.arc(keyholeX, keyholeY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(keyholeX - 1.5, keyholeY, 3, 4);

  // Plastic sheen highlight on top
  const shineGradient = ctx.createLinearGradient(
    dispenserX,
    dispenserY,
    dispenserX,
    dispenserY + dispenserH * 0.3
  );
  shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shineGradient;
  ctx.beginPath();
  ctx.roundRect(dispenserX, dispenserY, dispenserW, dispenserH * 0.3, 4);
  ctx.fill();
}

/**
 * Creates a texture for the front door.
 * Includes metal panels, hinges, lock mechanism, and wear marks.
 *
 * @param graffiti - Array of graffiti to render on the door
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns Three.js texture ready to apply to a mesh
 */
export function createDoorTexture(
  graffiti: Graffiti[],
  width: number,
  height: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Base door color - grey/beige metal with slight gradient for depth
  const doorGradient = ctx.createLinearGradient(0, 0, width, 0);
  doorGradient.addColorStop(0, '#c8c0b0');
  doorGradient.addColorStop(0.5, '#d8d0c0');
  doorGradient.addColorStop(1, '#c8c0b0');
  ctx.fillStyle = doorGradient;
  ctx.fillRect(0, 0, width, height);

  // Vertical metal panels (typical public restroom door style)
  ctx.strokeStyle = '#b0a898';
  ctx.lineWidth = 3;

  // Left edge panel line
  ctx.beginPath();
  ctx.moveTo(width * 0.15, 0);
  ctx.lineTo(width * 0.15, height);
  ctx.stroke();

  // Right edge panel line
  ctx.beginPath();
  ctx.moveTo(width * 0.85, 0);
  ctx.lineTo(width * 0.85, height);
  ctx.stroke();

  // Center vertical line
  ctx.beginPath();
  ctx.moveTo(width * 0.5, 0);
  ctx.lineTo(width * 0.5, height);
  ctx.stroke();

  // Horizontal reinforcement bars
  [0.25, 0.5, 0.75].forEach(pos => {
    ctx.strokeStyle = '#b0a898';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.15, height * pos);
    ctx.lineTo(width * 0.85, height * pos);
    ctx.stroke();
  });

  // Add metallic texture with subtle lines
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (let i = 0; i < height; i += 3) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Lock mechanism on right side
  const lockX = width * 0.88;
  const lockY = height * 0.52;

  // Lock housing (metallic)
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(lockX - 30, lockY - 20, 50, 40);
  ctx.strokeStyle = '#707070';
  ctx.lineWidth = 2;
  ctx.strokeRect(lockX - 30, lockY - 20, 50, 40);

  // Occupied indicator (red circle)
  ctx.beginPath();
  ctx.arc(lockX - 10, lockY, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#c0392b';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Lock bolt
  ctx.fillStyle = '#707070';
  ctx.fillRect(lockX + 12, lockY - 6, 18, 12);

  // Hinges on left side (3 hinges)
  [0.15, 0.5, 0.85].forEach(pos => {
    const hingeY = height * pos;
    ctx.fillStyle = '#888';
    ctx.fillRect(width * 0.02, hingeY - 15, 35, 30);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(width * 0.02, hingeY - 15, 35, 30);

    // Hinge screws
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(width * 0.02 + 10, hingeY - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width * 0.02 + 10, hingeY + 5, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Scuffs and wear marks at bottom
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#000';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * width;
    const y = height - Math.random() * 100;
    const w = Math.random() * 30 + 10;
    ctx.fillRect(x, y, w, 2);
  }
  ctx.globalAlpha = 1;

  // Calculate opacity for each graffiti and render
  const graffitiWithOpacity = graffiti.map(g => ({
    ...g,
    opacity: calculateOpacity(g.createdAt, g.expiresAt, g.implement)
  }));

  // Removed debug logging - see wall-rendering.ts for texture logs

  renderGraffitiStrokes(ctx, graffitiWithOpacity, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a checkerboard floor texture.
 * Simple alternating tile pattern in beige tones.
 *
 * @param size - Canvas size in pixels (square)
 * @returns Three.js texture ready to apply to a mesh
 */
export function createFloorTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = size * dpr;
  canvas.height = size * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Checkerboard pattern
  const tileSize = 30;
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      ctx.fillStyle = isLight ? '#e8e0d0' : '#c8bfb0';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a grey ceiling texture with fluorescent light fixture.
 *
 * @param size - Canvas size in pixels (square)
 * @returns Three.js texture ready to apply to a mesh
 */
export function createCeilingTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;

  const ctx = canvas.getContext('2d')!;

  // Grey ceiling
  const gradient = ctx.createLinearGradient(0, 0, 0, size * 2);
  gradient.addColorStop(0, '#b0b0b0');
  gradient.addColorStop(1, '#a0a0a0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size * 2, size * 2);

  // Fluorescent light fixture
  const lightX = size - 50;
  const lightY = size - 10;
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(lightX, lightY, 100, 20);
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 2;
  ctx.strokeRect(lightX, lightY, 100, 20);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
