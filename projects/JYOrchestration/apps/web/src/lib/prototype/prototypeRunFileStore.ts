import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PrototypeRun, PrototypeRunFileEnvelope } from "@/lib/prototype/prototypeRunTypes";

function dataDir(): string {
  return join(process.cwd(), ".data", "prototype-runs");
}

function filePath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(dataDir(), `${safe}.json`);
}

function emptyEnvelope(): PrototypeRunFileEnvelope {
  return { runs: [] };
}

export function loadPrototypeRunsEnvelope(projectId: string): PrototypeRunFileEnvelope {
  const p = filePath(projectId);
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<PrototypeRunFileEnvelope>;
    if (!parsed || !Array.isArray(parsed.runs)) return emptyEnvelope();
    return { runs: parsed.runs as PrototypeRun[] };
  } catch {
    return emptyEnvelope();
  }
}

export function savePrototypeRunsEnvelope(projectId: string, envelope: PrototypeRunFileEnvelope): void {
  const p = filePath(projectId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(envelope, null, 2), "utf8");
}

export function upsertPrototypeRun(projectId: string, run: PrototypeRun): void {
  const env = loadPrototypeRunsEnvelope(projectId);
  const idx = env.runs.findIndex((r) => r.id === run.id);
  const nextRuns = idx >= 0 ? env.runs.map((r, i) => (i === idx ? run : r)) : [...env.runs, run];
  savePrototypeRunsEnvelope(projectId, { runs: nextRuns });
}
