"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type {
  PrototypePreviewMobileDevice,
  PrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";
import {
  readProjectPrototypePreviewSnapshot,
  subscribeProjectPrototypePreview,
  writeProjectPrototypePreviewMobileDevice,
  writeProjectPrototypePreviewWorkMode,
  type ProjectPrototypePreviewSnapshot,
} from "@/lib/project/projectPrototypePreviewStore";

const SERVER_DEFAULT: ProjectPrototypePreviewSnapshot = {
  prototypePreviewWorkMode: "auto",
  prototypePreviewMobileDevice: "iphone",
};

const clientSnapCache = new Map<
  string,
  { key: string; snap: ProjectPrototypePreviewSnapshot }
>();

function getClientSnapshot(projectId: string): ProjectPrototypePreviewSnapshot {
  const next = readProjectPrototypePreviewSnapshot(projectId);
  const key = JSON.stringify(next);
  const prev = clientSnapCache.get(projectId);
  if (prev && prev.key === key) return prev.snap;
  clientSnapCache.set(projectId, { key, snap: next });
  return next;
}

function getServerSnapshot(): ProjectPrototypePreviewSnapshot {
  return SERVER_DEFAULT;
}

export function useProjectPrototypePreview(projectId: string | undefined): ProjectPrototypePreviewSnapshot & {
  setPrototypePreviewWorkMode: (v: PrototypePreviewWorkMode) => void;
  setPrototypePreviewMobileDevice: (v: PrototypePreviewMobileDevice) => void;
} {
  const pid = String(projectId ?? "").trim();

  const noopSetWorkMode = useCallback((v: PrototypePreviewWorkMode) => {
    void v;
  }, []);
  const noopSetMobile = useCallback((v: PrototypePreviewMobileDevice) => {
    void v;
  }, []);

  const snap = useSyncExternalStore(
    (onStoreChange) => (pid ? subscribeProjectPrototypePreview(onStoreChange, pid) : (() => {}) as () => void),
    () => (pid ? getClientSnapshot(pid) : SERVER_DEFAULT),
    getServerSnapshot,
  );

  const setPrototypePreviewWorkMode = useCallback(
    (v: PrototypePreviewWorkMode) => {
      if (!pid) return;
      writeProjectPrototypePreviewWorkMode(pid, v);
    },
    [pid],
  );

  const setPrototypePreviewMobileDevice = useCallback(
    (v: PrototypePreviewMobileDevice) => {
      if (!pid) return;
      writeProjectPrototypePreviewMobileDevice(pid, v);
    },
    [pid],
  );

  return useMemo(
    () => ({
      ...snap,
      setPrototypePreviewWorkMode: pid ? setPrototypePreviewWorkMode : noopSetWorkMode,
      setPrototypePreviewMobileDevice: pid ? setPrototypePreviewMobileDevice : noopSetMobile,
    }),
    [snap, pid, noopSetWorkMode, noopSetMobile, setPrototypePreviewWorkMode, setPrototypePreviewMobileDevice],
  );
}
