"use client";

import { useEffect, useRef, useState } from "react";

/** 저장 흐름: idle → saving → saved | error (`useSavePulseToast`와 호환). */
export type SaveFlowState = "idle" | "saving" | "saved" | "error";

/**
 * `saving` → `saved` 전이 시 짧은 저장 완료 토스트(표시 여부)를 켭니다.
 */
export function useSavePulseToast(saveState: SaveFlowState, visibleMs = 2000) {
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const saveToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSaveStateRef = useRef<SaveFlowState>("idle");

  useEffect(() => {
    const prev = prevSaveStateRef.current;
    prevSaveStateRef.current = saveState;
    if (prev === "saving" && saveState === "saved") {
      if (saveToastHideTimerRef.current) clearTimeout(saveToastHideTimerRef.current);
      // Save FSM edge: show pulse once when remote persist completes (same as legacy requirements hook).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional transition-driven UI pulse
      setSaveToastVisible(true);
      saveToastHideTimerRef.current = setTimeout(() => {
        setSaveToastVisible(false);
        saveToastHideTimerRef.current = null;
      }, visibleMs);
    }
  }, [saveState, visibleMs]);

  useEffect(() => {
    return () => {
      if (saveToastHideTimerRef.current) {
        clearTimeout(saveToastHideTimerRef.current);
        saveToastHideTimerRef.current = null;
      }
    };
  }, []);

  return { saveToastVisible };
}
