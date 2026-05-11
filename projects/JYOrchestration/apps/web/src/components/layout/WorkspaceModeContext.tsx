"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";
import {
  inferDefaultWorkspaceModeFromWidth,
  parseLayoutPreviewParam,
  readLayoutPreviewSessionMode,
  readStoredWorkspaceMode,
  resolveEffectiveLayout,
  stripLayoutPreviewParamFromAddressBar,
  syncLayoutPreviewSessionIfOpen,
  writeLayoutPreviewSessionMode,
  writeStoredWorkspaceMode,
  type WorkspaceEffectiveLayout,
  type WorkspaceMode,
} from "@/lib/ui/workspaceMode";

export type WorkspaceModeContextValue = Readonly<{
  mode: WorkspaceMode;
  setMode: (next: WorkspaceMode) => void;
  effectiveLayout: WorkspaceEffectiveLayout;
}>;

const WorkspaceModeContext = createContext<WorkspaceModeContextValue | null>(null);

export function WorkspaceModeProvider({ children }: { readonly children: ReactNode }) {
  const layoutMqIsMobile = useLayoutMobileBreakpoint();
  const [mode, setModeState] = useState<WorkspaceMode>("AUTO");
  /** localStorage 등 클라이언트 전용 소스 반영 전에는 항상 `AUTO`로 노출해 SSR·하이드레이션과 맞춘다. */
  const [workspaceModeBootstrapped, setWorkspaceModeBootstrapped] = useState(false);

  /* 최초 마운트: localStorage 또는 뷰포트 기반 기본(DESKTOP/모바일)으로 동기화 */
  /* eslint-disable react-hooks/set-state-in-effect -- 단일 bootstrap */
  useEffect(() => {
    const fromSession = readLayoutPreviewSessionMode();
    if (fromSession) {
      setModeState(fromSession);
      setWorkspaceModeBootstrapped(true);
      return;
    }
    const fromUrl = parseLayoutPreviewParam(window.location.search);
    if (fromUrl) {
      setModeState(fromUrl);
      writeLayoutPreviewSessionMode(fromUrl);
      stripLayoutPreviewParamFromAddressBar();
      setWorkspaceModeBootstrapped(true);
      return;
    }
    const stored = readStoredWorkspaceMode();
    if (stored) {
      setModeState(stored);
      setWorkspaceModeBootstrapped(true);
      return;
    }
    const inferred = inferDefaultWorkspaceModeFromWidth(window.innerWidth);
    writeStoredWorkspaceMode(inferred);
    setModeState(inferred);
    setWorkspaceModeBootstrapped(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setMode = useCallback((next: WorkspaceMode) => {
    setWorkspaceModeBootstrapped(true);
    setModeState(next);
    writeStoredWorkspaceMode(next);
    syncLayoutPreviewSessionIfOpen(next);
  }, []);

  const displayMode = workspaceModeBootstrapped ? mode : "AUTO";

  const effectiveLayout = useMemo(
    () => resolveEffectiveLayout(displayMode, layoutMqIsMobile),
    [displayMode, layoutMqIsMobile]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.jyoWorkspaceEffective = effectiveLayout.toLowerCase();
    document.documentElement.dataset.jyoWorkspaceMode = displayMode.toLowerCase();
    return () => {
      delete document.documentElement.dataset.jyoWorkspaceEffective;
      delete document.documentElement.dataset.jyoWorkspaceMode;
    };
  }, [effectiveLayout, displayMode]);

  const value = useMemo(
    () => ({
      mode: displayMode,
      setMode,
      effectiveLayout,
    }),
    [displayMode, setMode, effectiveLayout]
  );

  return <WorkspaceModeContext.Provider value={value}>{children}</WorkspaceModeContext.Provider>;
}

export function useWorkspaceMode(): WorkspaceModeContextValue {
  const v = useContext(WorkspaceModeContext);
  if (!v) {
    throw new Error("useWorkspaceMode must be used within WorkspaceModeProvider");
  }
  return v;
}

export function useWorkspaceModeOptional(): WorkspaceModeContextValue | null {
  return useContext(WorkspaceModeContext);
}
