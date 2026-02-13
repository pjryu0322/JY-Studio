'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RotationState, WatchItem } from '../_types/monitor';

export function useRotation(items: WatchItem[], intervalSec: number) {
  const [state, setState] = useState<RotationState>('STOPPED');
  const [activeCode, setActiveCode] = useState<string | undefined>(items[0]?.code);
  const [lockCode, setLockCode] = useState<string | undefined>(undefined);
  const [remainingSec, setRemainingSec] = useState<number>(Math.max(1, intervalSec));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endRef = useRef<number>(0);

  const candidates = useMemo(() => items.filter((v) => !v.pinned).map((v) => v.code), [items]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const moveTo = (delta: 1 | -1) => {
    if (candidates.length === 0) {
      setState('PAUSED_NO_TARGET');
      return;
    }
    setActiveCode((prev) => {
      const idx = prev ? candidates.indexOf(prev) : -1;
      const i = idx < 0 ? 0 : (idx + delta + candidates.length) % candidates.length;
      return candidates[i];
    });
    endRef.current = Date.now() + Math.max(1, intervalSec) * 1000;
    setRemainingSec(Math.max(1, intervalSec));
  };

  const pauseByInteraction = () => {
    clearTimer();
    setState((prev) => (prev === 'PLAYING' ? 'PAUSED_INTERACTION' : prev));
  };

  const pauseByUser = () => {
    clearTimer();
    setState('PAUSED_USER');
  };

  const play = () => {
    clearTimer();
    if (candidates.length === 0) {
      setState('PAUSED_NO_TARGET');
      return;
    }
    if (!activeCode || !candidates.includes(activeCode)) setActiveCode(candidates[0]);
    setState('PLAYING');
    endRef.current = Date.now() + Math.max(1, intervalSec) * 1000;
    setRemainingSec(Math.max(1, intervalSec));

    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) moveTo(1);
    }, 250);
  };

  const stop = () => {
    clearTimer();
    setState('STOPPED');
    setRemainingSec(Math.max(1, intervalSec));
  };

  const toggleLock = (on: boolean) => {
    if (on) setLockCode((prev) => prev ?? activeCode);
    else setLockCode(undefined);
  };

  const lockCurrent = () => setLockCode(activeCode);

  useEffect(() => {
    if (state === 'PLAYING' && candidates.length === 0) {
      clearTimer();
      setState('PAUSED_NO_TARGET');
    }
  }, [candidates, state]);

  useEffect(() => {
    setRemainingSec(Math.max(1, intervalSec));
  }, [intervalSec]);

  useEffect(() => () => clearTimer(), []);

  return {
    state,
    activeCode,
    setActiveCode,
    lockCode,
    viewCode: lockCode ?? activeCode,
    remainingSec,
    candidatesCount: candidates.length,
    play,
    pauseByUser,
    pauseByInteraction,
    stop,
    prev: () => moveTo(-1),
    next: () => moveTo(1),
    toggleLock,
    lockCurrent,
  };
}
