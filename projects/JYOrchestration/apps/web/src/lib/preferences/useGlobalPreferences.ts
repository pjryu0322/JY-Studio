"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readGlobalPreferencesSnapshot,
  subscribeGlobalPreferences,
  writeAiFacilitatorAutoJoin,
  writeDevPanelVisible,
  writeSettingsMenuPersona,
  type GlobalPreferencesSnapshot,
  type SettingsMenuPersona,
} from "@/lib/preferences/globalPreferences";

export function useGlobalPreferences(): GlobalPreferencesSnapshot & {
  setAiFacilitatorAutoJoin: (v: boolean) => void;
  setDevPanelVisible: (v: boolean) => void;
  setSettingsMenuPersona: (v: SettingsMenuPersona) => void;
} {
  const [snap, setSnap] = useState<GlobalPreferencesSnapshot>(() => readGlobalPreferencesSnapshot());

  useEffect(() => {
    setSnap(readGlobalPreferencesSnapshot());
    return subscribeGlobalPreferences(() => setSnap(readGlobalPreferencesSnapshot()));
  }, []);

  const setAiFacilitatorAutoJoin = useCallback((v: boolean) => {
    writeAiFacilitatorAutoJoin(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setDevPanelVisible = useCallback((v: boolean) => {
    writeDevPanelVisible(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setSettingsMenuPersona = useCallback((v: SettingsMenuPersona) => {
    writeSettingsMenuPersona(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);

  return useMemo(
    () => ({
      ...snap,
      setAiFacilitatorAutoJoin,
      setDevPanelVisible,
      setSettingsMenuPersona,
    }),
    [
      snap,
      setAiFacilitatorAutoJoin,
      setDevPanelVisible,
      setSettingsMenuPersona,
    ]
  );
}
