"use client";

import { useState } from "react";

const LABELS_KEY = "chunkstudio:workspace:show-labels";

interface WorkspacePreferences {
  showLabels: boolean;
  setShowLabels: (value: boolean) => void;
}

export function useWorkspacePreferences(): WorkspacePreferences {
  const [showLabels, setShowLabelsState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(LABELS_KEY) !== "false";
    } catch {
      return true;
    }
  });

  const setShowLabels = (value: boolean) => {
    setShowLabelsState(value);
    try {
      window.localStorage.setItem(LABELS_KEY, value ? "true" : "false");
    } catch {
      // ignore localStorage write failures
    }
  };

  return { showLabels, setShowLabels };
}
