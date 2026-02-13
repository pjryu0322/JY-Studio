'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RotationState, WatchItem } from '../_types/monitor';

type UseRotationParams = {
  items: WatchItem[];
  intervalSec: number;
  initialCode?: string;
};

export function useRotation({ items, intervalSec, initialCode }: UseRotationParams) {
  const [state, setState] = useState<RotationState>('STOPPED');
  const [activeCode, setActiveCode] = useState<string | undefined>(initialCode);
  const [lockCode, setLockCode] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const candidates = useMemo(() => items.filter((item) => !item.pinned).map((item) => item.code), [items]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const gotoNext = () => {
    if (candidates.length === 0) {
      setState('PAUSED_NO_TARGET');
      return;
    }

    setActiveCode((prev) => {
      const idx = prev ? candidates.indexOf(prev) : -1;
      const nextIdx = idx < 0 ? 0 : (idx + 1) % candidates.length;
      return candidates[nextIdx];
    });
  };

  const play = () => {
    clearTimer();

    if (candidates.length === 0) {
      setState('PAUSED_NO_TARGET');
      return;
    }

    setState('PLAYING');
    if (!activeCode || !candidates.includes(activeCode)) {
      setActiveCode(candidates[0]);
    }

    timerRef.current = setInterval(() => {
      gotoNext();
    }, Math.max(1, intervalSec) * 1000);
  };

  const pauseByUser = () => {
    clearTimer();
    setState('PAUSED_USER');
  };

  const pauseByInteraction = () => {
    clearTimer();
    setState((prev) => (prev === 'PLAYING' ? 'PAUSED_INTERACTION' : prev));
  };

  const stop = () => {
    clearTimer();
    setState('STOPPED');
  };

  const setLocked = (enabled: boolean) => {
    if (enabled) {
      setLockCode(activeCode);
    } else {
      setLockCode(undefined);
    }
  };

  useEffect(() => {
    if (state === 'PLAYING') {
      if (candidates.length === 0) {
        clearTimer();
        setState('PAUSED_NO_TARGET');
        return;
      }
      if (activeCode && !candidates.includes(activeCode)) {
        setActiveCode(candidates[0]);
      }
    }
  }, [candidates, state, activeCode]);

  useEffect(() => () => clearTimer(), []);

  return {
    state,
    activeCode,
    lockCode,
    viewCode: lockCode ?? activeCode,
    candidatesCount: candidates.length,
    play,
    stop,
    pauseByUser,
    pauseByInteraction,
    gotoNext,
    setActiveCode,
    setLocked,
  };
}
