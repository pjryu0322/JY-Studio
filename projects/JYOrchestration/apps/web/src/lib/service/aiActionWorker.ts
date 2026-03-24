import { randomUUID } from "crypto";
import { computeIdleSleepMs, pollAiMemberActionsOnce } from "@/lib/ai-member/aiMemberActionDispatcher";

export type AiActionWorkerOptions = {
  pollIntervalMs: number;
  pollIdleMs: number;
};

export function startAiActionWorker(opts: AiActionWorkerOptions): void {
  const instanceId = `ai-action-worker:${randomUUID()}`;
  let idleStreak = 0;

  const tick = async () => {
    let delay = opts.pollIdleMs;
    try {
      const r = await pollAiMemberActionsOnce(instanceId);
      if (r === "claimed") {
        idleStreak = 0;
        delay = opts.pollIntervalMs;
      } else {
        idleStreak += 1;
        delay = Math.max(opts.pollIdleMs, computeIdleSleepMs(idleStreak));
      }
    } catch (e) {
      console.error("[ai-action-worker] tick error:", e);
      delay = opts.pollIdleMs;
    }
    setTimeout(tick, delay);
  };

  tick();
  console.info("[ai-action-worker] started", { instanceId, ...opts });
}
