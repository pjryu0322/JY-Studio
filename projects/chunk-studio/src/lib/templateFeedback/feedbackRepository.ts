import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TemplateFeedbackEvent } from "./feedbackTypes";

const baseDir = path.join(process.cwd(), "data", "feedback");

function feedbackDir(family: string, docType: string): string {
  return path.join(baseDir, family, docType);
}

function feedbackFilePath(family: string, docType: string, docId: string): string {
  return path.join(feedbackDir(family, docType), `${docId}.json`);
}

async function safeReadArray(filePath: string): Promise<TemplateFeedbackEvent[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TemplateFeedbackEvent[]) : [];
  } catch {
    return [];
  }
}

export async function appendFeedbackEvent(event: TemplateFeedbackEvent): Promise<void> {
  const filePath = feedbackFilePath(event.family, event.docType, event.docId);
  await mkdir(path.dirname(filePath), { recursive: true });
  const current = await safeReadArray(filePath);
  current.push(event);
  await writeFile(filePath, JSON.stringify(current, null, 2), "utf-8");
}

export async function getFeedbackEvents(input: {
  family: string;
  docType: string;
  docId: string;
}): Promise<TemplateFeedbackEvent[]> {
  return safeReadArray(feedbackFilePath(input.family, input.docType, input.docId));
}

export async function listFeedbackEvents(input: {
  family: string;
  docType: string;
}): Promise<Array<{ docId: string; count: number; latestAt: string | null }>> {
  const dir = feedbackDir(input.family, input.docType);
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const rows = await Promise.all(
    files
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const docId = name.replace(/\.json$/i, "");
        const list = await safeReadArray(path.join(dir, name));
        const latestAt = list.length > 0 ? list[list.length - 1]?.timestamp ?? null : null;
        return { docId, count: list.length, latestAt };
      })
  );

  return rows.sort((a, b) => {
    const av = a.latestAt ?? "";
    const bv = b.latestAt ?? "";
    return av < bv ? 1 : -1;
  });
}
