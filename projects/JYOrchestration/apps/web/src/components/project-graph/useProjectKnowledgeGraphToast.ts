"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_MS = 2800;

export function useProjectKnowledgeGraphToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const showToast = useCallback(
    (text: string) => {
      const trimmed = String(text ?? "").trim();
      if (!trimmed) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(trimmed);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setMessage(null);
      }, TOAST_MS);
    },
    [],
  );

  useEffect(() => () => clear(), [clear]);

  return { toastMessage: message, showToast, clearToast: clear };
}
