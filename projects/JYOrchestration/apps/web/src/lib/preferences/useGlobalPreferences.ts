"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
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
  const snap = useSyncExternalStore(
    subscribeGlobalPreferences,
    readGlobalPreferencesSnapshot,
    readGlobalPreferencesSnapshot,
  );

  const setAiFacilitatorAutoJoin = useCallback((v: boolean) => {
    writeAiFacilitatorAutoJoin(v);
  }, []);
  const setDevPanelVisible = useCallback((v: boolean) => {
    writeDevPanelVisible(v);
  }, []);
  const setSettingsMenuPersona = useCallback((v: SettingsMenuPersona) => {
    writeSettingsMenuPersona(v);
  }, []);
  const setPrototypePreviewWorkMode = useCallback((v: PrototypePreviewWorkMode) => {
    writePrototypePreviewWorkMode(v);
  }, []);
  const setPrototypePreviewMobileDevice = useCallback((v: PrototypePreviewMobileDevice) => {
    writePrototypePreviewMobileDevice(v);
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
