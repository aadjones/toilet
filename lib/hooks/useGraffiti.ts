"use client";

import { useState, useCallback, useEffect } from "react";
import { type Graffiti, type WallType } from "@/lib/config";

type GraffitiState = Record<WallType, Graffiti[]>;

interface UseGraffitiReturn {
  graffiti: GraffitiState;
  isLoading: boolean;
  addLocalGraffiti: (wall: WallType, newGraffiti: Graffiti) => void;
  deleteGraffiti: (id: string) => Promise<void>;
  clearAllGraffiti: () => Promise<void>;
  getWallGraffiti: (wall: WallType) => Graffiti[];
}

/**
 * Hook for managing graffiti data with real-time Ably updates
 */
export function useGraffiti(): UseGraffitiReturn {
  const [graffiti, setGraffiti] = useState<GraffitiState>({
    front: [],
    left: [],
    right: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch graffiti for all walls
  const fetchGraffiti = useCallback(async () => {
    try {
      const walls: WallType[] = ["front", "left", "right"];
      const results = await Promise.all(
        walls.map(async (wall) => {
          const res = await fetch(`/api/graffiti?wall=${wall}`);
          if (!res.ok) return { wall, graffiti: [] };
          const data = await res.json();
          return { wall, graffiti: data.graffiti };
        })
      );

      const newGraffiti: GraffitiState = {
        front: [],
        left: [],
        right: [],
      };
      results.forEach(({ wall, graffiti }) => {
        newGraffiti[wall] = graffiti;
      });
      setGraffiti(newGraffiti);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch graffiti:", error);
      setIsLoading(false);
    }
  }, []);

  // Add graffiti instantly to local state (optimistic update)
  const addLocalGraffiti = useCallback(
    (wall: WallType, newGraffiti: Graffiti) => {
      setGraffiti((prev) => ({
        ...prev,
        [wall]: [...prev[wall], newGraffiti],
      }));
    },
    []
  );

  // Delete specific graffiti by ID
  const deleteGraffiti = useCallback(async (id: string) => {
    try {
      const response = await fetch("/api/graffiti/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        // Remove from local state
        setGraffiti((prev) => ({
          front: prev.front.filter((g) => g.id !== id),
          left: prev.left.filter((g) => g.id !== id),
          right: prev.right.filter((g) => g.id !== id),
        }));
        console.log("Graffiti deleted:", id);
      } else {
        console.error("Failed to delete graffiti");
      }
    } catch (error) {
      console.error("Error deleting graffiti:", error);
    }
  }, []);

  // Clear all graffiti from database
  const clearAllGraffiti = useCallback(async () => {
    if (!confirm("Clear all graffiti from all walls? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/graffiti/clear", {
        method: "POST",
      });

      if (response.ok) {
        setGraffiti({
          front: [],
          left: [],
          right: [],
        });
        console.log("All graffiti cleared");
      } else {
        console.error("Failed to clear graffiti");
      }
    } catch (error) {
      console.error("Error clearing graffiti:", error);
    }
  }, []);

  // Get graffiti for a specific wall
  const getWallGraffiti = useCallback(
    (wall: WallType): Graffiti[] => {
      return graffiti[wall];
    },
    [graffiti]
  );

  // Initial fetch
  useEffect(() => {
    fetchGraffiti();
  }, [fetchGraffiti]);

  // Real-time subscription to graffiti updates via Ably
  useEffect(() => {
    const initAbly = async () => {
      try {
        const Ably = (await import("ably")).default;
        const ably = new Ably.Realtime({ authUrl: "/api/ably/token" });

        const channel = ably.channels.get("graffiti-wall");

        channel.subscribe("new-graffiti", (message) => {
          const newGraffiti = message.data as Graffiti;
          // Add the new graffiti to the appropriate wall
          setGraffiti((prev) => ({
            ...prev,
            [newGraffiti.wall]: [...prev[newGraffiti.wall], newGraffiti],
          }));
        });

        return () => {
          channel.unsubscribe();
          ably.close();
        };
      } catch (error) {
        console.error("Failed to initialize Ably:", error);
      }
    };

    const cleanup = initAbly();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  return {
    graffiti,
    isLoading,
    addLocalGraffiti,
    deleteGraffiti,
    clearAllGraffiti,
    getWallGraffiti,
  };
}
