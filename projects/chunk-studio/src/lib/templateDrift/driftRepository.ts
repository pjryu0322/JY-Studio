import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DriftResult } from "./driftTypes";

const baseDir = path.join(process.cwd(), "data", "drifts");

interface DriftPathInput {
  family: string;
  templateId: string;
  version: string;
}

interface DriftDocInput extends DriftPathInput {
  docId: string;
}

export interface DriftHistoryItem {
  docId: string;
  severity: DriftResult["severity"];
  score: number;
  updatedAt: string;
}

function driftDir(input: DriftPathInput): string {
  return path.join(baseDir, input.family, input.templateId, input.version);
}

function driftFilePath(input: DriftDocInput): string {
  return path.join(driftDir(input), `${input.docId}.json`);
}

export async function saveDriftResult(input: {
  family: string;
  templateId: string;
  version: string;
  docId: string;
  driftResult: DriftResult;
}): Promise<void> {
  const filePath = driftFilePath(input);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(input.driftResult, null, 2), "utf-8");
}

export async function getDriftResult(input: DriftDocInput): Promise<DriftResult | null> {
  try {
    const raw = await readFile(driftFilePath(input), "utf-8");
    return JSON.parse(raw) as DriftResult;
  } catch {
    return null;
  }
}

export async function listDriftResults(input: DriftPathInput): Promise<DriftHistoryItem[]> {
  const dir = driftDir(input);
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const items = await Promise.all(
    entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const docId = name.replace(/\.json$/i, "");
        const filePath = path.join(dir, name);
        try {
          const [raw, info] = await Promise.all([
            readFile(filePath, "utf-8"),
            stat(filePath),
          ]);
          const parsed = JSON.parse(raw) as DriftResult;
          return {
            docId,
            severity: parsed.severity,
            score: parsed.score,
            updatedAt: info.mtime.toISOString(),
          } as DriftHistoryItem;
        } catch {
          return null;
        }
      })
  );

  return items
    .filter((item): item is DriftHistoryItem => Boolean(item))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
