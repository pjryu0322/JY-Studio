'use client';

import { RotationState } from '../_types/monitor';

export function RotationControls({
  state,
  remainingSec,
  lockCode,
  lockEnabled,
  onPrev,
  onPlay,
  onPause,
  onNext,
  onToggleLock,
  onLockCurrent,
}: {
  state: RotationState;
  remainingSec: number;
  lockCode?: string;
  lockEnabled: boolean;
  onPrev: () => void;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onToggleLock: (enabled: boolean) => void;
  onLockCurrent: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={onPrev}>Prev</button>
      <button onClick={onPlay}>▶</button>
      <button onClick={onPause}>⏸</button>
      <button onClick={onNext}>Next</button>
      <label>
        <input type="checkbox" checked={lockEnabled} onChange={(e) => onToggleLock(e.target.checked)} /> LOCK
      </label>
      <button onClick={onLockCurrent}>현재 종목으로 고정</button>
      <span>state: {state}</span>
      <span>남은시간: {remainingSec}s</span>
      <span>lockCode: {lockCode ?? '-'}</span>
    </div>
  );
}
