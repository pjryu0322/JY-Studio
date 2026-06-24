export const KNOWLEDGE_REPLAY_AUTOPLAY_MS = 1200;

export function replayPreviousIndex(selectedIndex: number): number {
  return Math.max(0, selectedIndex - 1);
}

export function replayNextIndex(selectedIndex: number, revisionCount: number): number {
  if (revisionCount <= 0) return 0;
  return Math.min(revisionCount - 1, selectedIndex + 1);
}

export function replayLatestIndex(revisionCount: number): number {
  return Math.max(0, revisionCount - 1);
}

export function isReplayPreviousDisabled(selectedIndex: number): boolean {
  return selectedIndex <= 0;
}

export function isReplayNextDisabled(selectedIndex: number, revisionCount: number): boolean {
  return revisionCount <= 0 || selectedIndex >= revisionCount - 1;
}

export function isReplayLatestDisabled(selectedIndex: number, revisionCount: number): boolean {
  return revisionCount <= 0 || selectedIndex === revisionCount - 1;
}

/** Autoplay tick: returns next index and whether playback should stop at end. */
export function replayAutoplayTick(
  selectedIndex: number,
  revisionCount: number,
): Readonly<{ readonly nextIndex: number; readonly stop: boolean }> {
  if (revisionCount <= 0) {
    return { nextIndex: 0, stop: true };
  }
  if (selectedIndex >= revisionCount - 1) {
    return { nextIndex: selectedIndex, stop: true };
  }
  return { nextIndex: selectedIndex + 1, stop: false };
}
