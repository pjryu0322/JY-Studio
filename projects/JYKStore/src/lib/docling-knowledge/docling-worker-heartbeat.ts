import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const HEARTBEAT_PATH = join(tmpdir(), "jykstore-worker-heartbeat.json");

/** Dev/ops-only: worker liveness without changing public health response shape. */
export function writeWorkerHeartbeat(input: {
  lockOwner: string;
  knowledgePipelineEnabled: boolean;
}): void {
  try {
    mkdirSync(dirname(HEARTBEAT_PATH), { recursive: true });
    writeFileSync(
      HEARTBEAT_PATH,
      JSON.stringify({
        at: new Date().toISOString(),
        lockOwner: input.lockOwner,
        knowledgePipelineEnabled: input.knowledgePipelineEnabled,
      }),
      "utf8",
    );
  } catch {
    // best-effort
  }
}

export function getWorkerHeartbeatPath(): string {
  return HEARTBEAT_PATH;
}

export function readWorkerHeartbeat(): {
  at: string;
  lockOwner: string;
  knowledgePipelineEnabled: boolean;
  ageMs: number;
  ok: boolean;
} | null {
  try {
    if (!existsSync(HEARTBEAT_PATH)) return null;
    const raw = JSON.parse(readFileSync(HEARTBEAT_PATH, "utf8")) as {
      at?: string;
      lockOwner?: string;
      knowledgePipelineEnabled?: boolean;
    };
    if (!raw.at || !raw.lockOwner) return null;
    const ageMs = Date.now() - Date.parse(raw.at);
    return {
      at: raw.at,
      lockOwner: raw.lockOwner,
      knowledgePipelineEnabled: Boolean(raw.knowledgePipelineEnabled),
      ageMs,
      ok: Number.isFinite(ageMs) && ageMs < 60_000,
    };
  } catch {
    return null;
  }
}
