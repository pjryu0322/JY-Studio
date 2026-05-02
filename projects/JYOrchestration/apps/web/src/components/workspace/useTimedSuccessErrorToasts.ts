"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimedSuccessErrorToastOptions = {
  successDismissMs?: number;
  errorDismissMs?: number;
};

/**
 * 성공·오류 `FixedToast`용 문자열 상태와 자동 해제 타이머.
 * 요구사항 워크스페이스 등 여러 화면에서 동일 동작을 재사용합니다.
 */
export function useTimedSuccessErrorToasts(options?: TimedSuccessErrorToastOptions) {
  const successDismissMs = options?.successDismissMs ?? 2000;
  const errorDismissMs = options?.errorDismissMs ?? 4500;

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const successToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSuccessToast = useCallback(() => {
    if (successToastHideTimerRef.current) {
      clearTimeout(successToastHideTimerRef.current);
      successToastHideTimerRef.current = null;
    }
    setSuccessToast(null);
  }, []);

  const clearErrorToast = useCallback(() => {
    if (errorToastHideTimerRef.current) {
      clearTimeout(errorToastHideTimerRef.current);
      errorToastHideTimerRef.current = null;
    }
    setErrorToast(null);
  }, []);

  const clearToasts = useCallback(() => {
    clearSuccessToast();
    clearErrorToast();
  }, [clearSuccessToast, clearErrorToast]);

  const showSuccessToast = useCallback(
    (message: string) => {
      if (successToastHideTimerRef.current) {
        clearTimeout(successToastHideTimerRef.current);
        successToastHideTimerRef.current = null;
      }
      setSuccessToast(message);
      successToastHideTimerRef.current = setTimeout(() => {
        setSuccessToast(null);
        successToastHideTimerRef.current = null;
      }, successDismissMs);
    },
    [successDismissMs]
  );

  const showErrorToast = useCallback(
    (message: string) => {
      if (errorToastHideTimerRef.current) {
        clearTimeout(errorToastHideTimerRef.current);
        errorToastHideTimerRef.current = null;
      }
      setErrorToast(message);
      errorToastHideTimerRef.current = setTimeout(() => {
        setErrorToast(null);
        errorToastHideTimerRef.current = null;
      }, errorDismissMs);
    },
    [errorDismissMs]
  );

  useEffect(() => {
    return () => {
      if (successToastHideTimerRef.current) {
        clearTimeout(successToastHideTimerRef.current);
        successToastHideTimerRef.current = null;
      }
      if (errorToastHideTimerRef.current) {
        clearTimeout(errorToastHideTimerRef.current);
        errorToastHideTimerRef.current = null;
      }
    };
  }, []);

  return {
    successToast,
    errorToast,
    showSuccessToast,
    showErrorToast,
    clearToasts,
  };
}
