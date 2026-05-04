"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readGlobalPreferencesSnapshot,
  subscribeGlobalPreferences,
  writeAiFacilitatorAutoJoin,
  writeDevPanelVisible,
  writePrototypePreviewMobileDevice,
  writePrototypePreviewWorkMode,
  writeSettingsMenuPersona,
  type GlobalPreferencesSnapshot,
  type SettingsMenuPersona,
} from "@/lib/preferences/globalPreferences";
import type {
  PrototypePreviewMobileDevice,
  PrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";

export function useGlobalPreferences(): GlobalPreferencesSnapshot & {
  setAiFacilitatorAutoJoin: (v: boolean) => void;
  setDevPanelVisible: (v: boolean) => void;
  setSettingsMenuPersona: (v: SettingsMenuPersona) => void;
  setPrototypePreviewWorkMode: (v: PrototypePreviewWorkMode) => void;
  setPrototypePreviewMobileDevice: (v: PrototypePreviewMobileDevice) => void;
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
  const setPrototypePreviewWorkMode = useCallback((v: PrototypePreviewWorkMode) => {
    writePrototypePreviewWorkMode(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);
  const setPrototypePreviewMobileDevice = useCallback((v: PrototypePreviewMobileDevice) => {
    writePrototypePreviewMobileDevice(v);
    setSnap(readGlobalPreferencesSnapshot());
  }, []);

  return useMemo(
    () => ({
      ...snap,
      setAiFacilitatorAutoJoin,
      setDevPanelVisible,
      setSettingsMenuPersona,
      setPrototypePreviewWorkMode,
      setPrototypePreviewMobileDevice,
    }),
    [
      snap,
      setAiFacilitatorAutoJoin,
      setDevPanelVisible,
      setSettingsMenuPersona,
      setPrototypePreviewWorkMode,
      setPrototypePreviewMobileDevice,
    ]
  );
}
