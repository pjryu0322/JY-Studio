export const PROJECT_GRAPH_LONG_PRESS_MS = 900;

export function shouldCancelLongPress(dx: number, dy: number, threshold = 10): boolean {
  return Math.hypot(dx, dy) > threshold;
}
