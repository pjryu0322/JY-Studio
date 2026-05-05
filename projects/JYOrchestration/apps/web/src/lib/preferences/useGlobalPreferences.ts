"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  readGlobalPreferencesSnapshot,
  subscribeGlobalPreferences,
  writeAiFacilitatorAutoJoin,
  writeDevPanelVisible,
  writeSettingsMenuPersona,
  type GlobalPreferencesSnapshot,
  type SettingsMenuPersona,
} from "@/lib/preferences/globalPreferences";

/** useSyncExternalStore는 값이 같을 때 동일 객체 참조를 돌려야 무한 렌더를 막을 수 있음 */
let clientSnapCache: GlobalPreferencesSnapshot | null = null;
let clientSnapKey = "";

function getClientPreferencesSnapshot(): GlobalPreferencesSnapshot {
  const next = readGlobalPreferencesSnapshot();
  const key = JSON.stringify(next);
  if (clientSnapCache && key === clientSnapKey) return clientSnapCache;
  clientSnapKey = key;
  clientSnapCache = next;
  return next;
}

let serverSnapCache: GlobalPreferencesSnapshot | null = null;
let serverSnapKey = "";

function getServerPreferencesSnapshot(): GlobalPreferencesSnapshot {
  const next = readGlobalPreferencesSnapshot();
  const key = JSON.stringify(next);
  if (serverSnapCache && key === serverSnapKey) return serverSnapCache;
  serverSnapKey = key;
  serverSnapCache = next;
  return next;
}

export function useGlobalPreferences(): GlobalPreferencesSnapshot & {
  setAiFacilitatorAutoJoin: (v: boolean) => void;
  setDevPanelVisible: (v: boolean) => void;
  setSettingsMenuPersona: (v: SettingsMenuPersona) => void;
} {
  const snap = useSyncExternalStore(
    subscribeGlobalPreferences,
    getClientPreferencesSnapshot,
    getServerPreferencesSnapshot,
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

  return useMemo(
    () => ({
      ...snap,
      setAiFacilitatorAutoJoin,
      setDevPanelVisible,
      setSettingsMenuPersona,
    }),
    [snap, setAiFacilitatorAutoJoin, setDevPanelVisible, setSettingsMenuPersona],
  );
}
