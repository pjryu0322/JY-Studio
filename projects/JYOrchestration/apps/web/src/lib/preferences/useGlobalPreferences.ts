"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readGlobalPreferencesSnapshot,
  subscribeGlobalPreferences,
  writeAiFacilitatorAutoJoin,
  writeDevPanelVisible,
  type GlobalPreferencesSnapshot,
} from "@/lib/preferences/globalPreferences";

export function useGlobalPreferences(): GlobalPreferencesSnapshot & {
  setAiFacilitatorAutoJoin: (v: boolean) => void;
  setDevPanelVisible: (v: boolean) => void;
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

  return useMemo(
    () => ({
      ...snap,
      setAiFacilitatorAutoJoin,
      setDevPanelVisible,
    }),
    [
      snap,
      setAiFacilitatorAutoJoin,
      setDevPanelVisible,
    ]
  );
}
