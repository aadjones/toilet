"use client";

import { type Graffiti } from "@/lib/config";
import { type FacingDirection } from "@/lib/geometry";

interface DebugPanelProps {
  // Camera settings
  fov: number;
  setFov: (fov: number) => void;
  cameraY: number;
  setCameraY: (y: number) => void;
  wallDistance: number;
  setWallDistance: (d: number) => void;
  wallHeight: number;
  setWallHeight: (h: number) => void;
  facing: FacingDirection;

  // Debug options
  debugUnlimitedPosting: boolean;
  onDebugUnlimitedPostingChange?: (enabled: boolean) => void;
  selectorMode: boolean;
  setSelectorMode: (mode: boolean) => void;

  // Selected graffiti
  selectedGraffiti: Graffiti[];
  setSelectedGraffiti: (graffiti: Graffiti[]) => void;
  onDeleteGraffiti: (id: string) => void;
  onClearAllGraffiti: () => void;
}

/**
 * Debug controls panel for adjusting camera and stall settings
 * Press ` to toggle visibility
 */
export function DebugPanel({
  fov,
  setFov,
  cameraY,
  setCameraY,
  wallDistance,
  setWallDistance,
  wallHeight,
  setWallHeight,
  facing,
  debugUnlimitedPosting,
  onDebugUnlimitedPostingChange,
  selectorMode,
  setSelectorMode,
  selectedGraffiti,
  setSelectedGraffiti,
  onDeleteGraffiti,
  onClearAllGraffiti,
}: DebugPanelProps) {
  return (
    <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded text-xs font-mono z-50 w-72 select-text border border-white/20 shadow-2xl">
      <div className="mb-3 text-sm font-bold border-b border-white/20 pb-2">
        Debug Controls (press ` to hide)
      </div>

      <div className="space-y-3">
        <div>
          <label className="block mb-1 text-white/70">FOV: {fov}°</label>
          <div className="text-[10px] text-white/40 mb-1">
            Field of view (wider = see more)
          </div>
          <input
            type="range"
            min="30"
            max="120"
            value={fov}
            onChange={(e) => setFov(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-white/70">
            Camera Y: {cameraY.toFixed(2)}
          </label>
          <div className="text-[10px] text-white/40 mb-1">
            Eye height (0 = center, negative = lower)
          </div>
          <input
            type="range"
            min="-0.8"
            max="0.8"
            step="0.05"
            value={cameraY}
            onChange={(e) => setCameraY(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-white/70">
            Wall Distance: {wallDistance.toFixed(1)}
          </label>
          <div className="text-[10px] text-white/40 mb-1">
            How far walls are from camera
          </div>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={wallDistance}
            onChange={(e) => setWallDistance(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-white/70">
            Wall Height: {wallHeight.toFixed(1)}
          </label>
          <div className="text-[10px] text-white/40 mb-1">Height of walls</div>
          <input
            type="range"
            min="1"
            max="4"
            step="0.1"
            value={wallHeight}
            onChange={(e) => setWallHeight(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="pt-2 border-t border-white/20 text-white/50 text-[10px] leading-tight">
          Facing: {facing}
          <br />
          Camera at (0, {cameraY.toFixed(2)}, 0)
          <br />
          Front wall at Z=-{wallDistance.toFixed(1)}
        </div>

        {/* Debug options */}
        <div className="pt-3 border-t border-white/20 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={debugUnlimitedPosting}
              onChange={(e) => onDebugUnlimitedPostingChange?.(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-white/70 text-xs">
              Unlimited posting (bypass session limit)
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectorMode}
              onChange={(e) => {
                setSelectorMode(e.target.checked);
                if (!e.target.checked) {
                  setSelectedGraffiti([]);
                }
              }}
              className="w-4 h-4"
            />
            <span className="text-white/70 text-xs">
              Selector mode (click to find graffiti)
            </span>
          </label>
        </div>

        {/* Selected graffiti list */}
        {selectorMode && selectedGraffiti.length > 0 && (
          <div className="pt-3 border-t border-white/20">
            <div className="text-white/70 text-xs font-semibold mb-2">
              Found {selectedGraffiti.length} graffiti at clicked point:
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {selectedGraffiti.map((g) => (
                <div
                  key={g.id}
                  className="bg-white/5 rounded px-2 py-1.5 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-white/50 truncate">
                      {g.id}
                    </div>
                    <div className="text-[9px] text-white/40">
                      {g.implement} • {g.strokeData.length} stroke(s)
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteGraffiti(g.id)}
                    className="bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-semibold transition-colors flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clear all graffiti button */}
        <div className="pt-3 border-t border-white/20">
          <button
            onClick={onClearAllGraffiti}
            className="w-full bg-red-600/80 hover:bg-red-600 text-white px-3 py-2 rounded text-xs font-semibold transition-colors"
          >
            Clear All Graffiti
          </button>
        </div>
      </div>
    </div>
  );
}
