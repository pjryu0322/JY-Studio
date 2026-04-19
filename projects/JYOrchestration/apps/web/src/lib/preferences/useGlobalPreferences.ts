"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readGlobalPreferencesSnapshot,
  subscribeGlobalPreferences,
  writeAiFacilitatorAutoJoin,
  writeAiResponseStyle,
  writeAutoEnterAfterCreate,
  writeAutoOpenLastProject,
  writeCompactMode,
  writeDevPanelVisible,
  writeReduceMotion,
  type AiResponseStyle,
  type GlobalPreferencesSnapshot,
} from "@/lib/preferences/globalPreferences";

export function useGlobalPreferences(): GlobalPreferencesSnapshot & {
  setCompactMode: (v: boolean) => void;
  setReduceMotion: (v: boolean) => void;
  setAutoOpenLastProject: (v: boolean) => void;
  setAutoEnterAfterCreate: (v: boolean) => void;
  setAiFacilitatorAutoJoin: (v: boolean) => void;
  setAiResponseStyle: (v: AiResponseStyle) => void;
  setDevPanelVisible: (v: boolean) => void;
} {
  const [snap, setSnap] = useState<GlobalPreferencesSnapshot>(() => readGlobalPreferencesSnapshot());

  useEffect(() => {
    setSnap(readGlobalPreferencesSnapshot());
    return subscribeGlobalPreferences(() => setSnap(readGlobalPreferencesSnapshot()));
  }, []);

  const setCompactMode = useCallback((v: boolean) => {
    writeCompactMode(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setReduceMotion = useCallback((v: boolean) => {
    writeReduceMotion(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setAutoOpenLastProject = useCallback((v: boolean) => {
    writeAutoOpenLastProject(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setAutoEnterAfterCreate = useCallback((v: boolean) => {
    writeAutoEnterAfterCreate(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setAiFacilitatorAutoJoin = useCallback((v: boolean) => {
    writeAiFacilitatorAutoJoin(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setAiResponseStyle = useCallback((v: AiResponseStyle) => {
    writeAiResponseStyle(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setDevPanelVisible = useCallback((v: boolean) => {
    writeDevPanelVisible(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);

  return useMemo(
    () => ({
      ...snap,
      setCompactMode,
      setReduceMotion,
      setAutoOpenLastProject,
      setAutoEnterAfterCreate,
      setAiFacilitatorAutoJoin,
      setAiResponseStyle,
      setDevPanelVisible,
    }),
    [
      snap,
      setCompactMode,
      setReduceMotion,
      setAutoOpenLastProject,
      setAutoEnterAfterCreate,
      setAiFacilitatorAutoJoin,
      setAiResponseStyle,
      setDevPanelVisible,
    ]
  );
}
