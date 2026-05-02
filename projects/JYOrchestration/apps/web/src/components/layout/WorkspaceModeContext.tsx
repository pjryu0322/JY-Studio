"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";
import {
  inferDefaultWorkspaceModeFromWidth,
  readStoredWorkspaceMode,
  resolveEffectiveLayout,
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

  /* 최초 마운트: localStorage 또는 뷰포트 기반 기본(DESKTOP/모바일)으로 동기화 */
  /* eslint-disable react-hooks/set-state-in-effect -- 단일 bootstrap */
  useEffect(() => {
    const stored = readStoredWorkspaceMode();
    if (stored) {
      setModeState(stored);
      return;
    }
    const inferred = inferDefaultWorkspaceModeFromWidth(window.innerWidth);
    writeStoredWorkspaceMode(inferred);
    setModeState(inferred);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setMode = useCallback((next: WorkspaceMode) => {
    setModeState(next);
    writeStoredWorkspaceMode(next);
  }, []);

  const effectiveLayout = useMemo(
    () => resolveEffectiveLayout(mode, layoutMqIsMobile),
    [mode, layoutMqIsMobile]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.jyoWorkspaceEffective = effectiveLayout.toLowerCase();
    document.documentElement.dataset.jyoWorkspaceMode = mode.toLowerCase();
    return () => {
      delete document.documentElement.dataset.jyoWorkspaceEffective;
      delete document.documentElement.dataset.jyoWorkspaceMode;
    };
  }, [effectiveLayout, mode]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      effectiveLayout,
    }),
    [mode, setMode, effectiveLayout]
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
