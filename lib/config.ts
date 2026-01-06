// Decay durations for each implement type (in milliseconds)
// These can be overridden via environment variables

export const DECAY_DURATIONS = {
  scribble: parseInt(process.env.SCRIBBLE_DURATION_MS || String(4 * 60 * 60 * 1000)), // 4 hours
  marker: parseInt(process.env.MARKER_DURATION_MS || String(24 * 60 * 60 * 1000)), // 1 day
  carved: parseInt(process.env.CARVED_DURATION_MS || String(7 * 24 * 60 * 60 * 1000)), // 1 week
} as const;

// Implement visual properties
export const IMPLEMENT_STYLES = {
  scribble: {
    color: '#555555',
    lineWidth: 2,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
  marker: {
    color: '#000000',
    lineWidth: 6,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
  carved: {
    color: '#8B8685',
    lineWidth: 1.5,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
} as const;

// Carved mode velocity threshold (pixels per millisecond)
// Lower = must move slower to register
export const CARVE_VELOCITY_THRESHOLD = 0.15;

// Session inactivity timeout (milliseconds)
export const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Polling interval for fetching new graffiti
export const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

// Wall types
export type WallType = 'front' | 'left' | 'right';
export type ImplementType = 'scribble' | 'marker' | 'carved';

// Stroke point
export interface StrokePoint {
  x: number; // 0-1 ratio
  y: number; // 0-1 ratio
}

// A single stroke (continuous line)
export type Stroke = StrokePoint[];

// Graffiti data structure
export interface Graffiti {
  id: string;
  wall: WallType;
  implement: ImplementType;
  strokeData: Stroke[];
  color: string;
  createdAt: string;
  expiresAt: string;
  opacity: number;
}
