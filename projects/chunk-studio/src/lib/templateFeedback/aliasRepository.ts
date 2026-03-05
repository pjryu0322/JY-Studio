import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeLabel } from "@/lib/templateAuto/normalize";
import { getFeedbackEvents, listFeedbackEvents } from "./feedbackRepository";
import type { TemplateFeedbackEvent } from "./feedbackTypes";

export interface AliasItem {
  from: string;
  to: string;
  count: number;
  enabled: boolean;
}

export interface AliasStore {
  labels: AliasItem[];
  sections: AliasItem[];
}

export interface AliasMapResult {
  labels: AliasItem[];
  sections: AliasItem[];
  labelAliasMap: Record<string, string>;
  sectionAliasMap: Record<string, string>;
  source: "repository" | "feedback";
}

const baseDir = path.join(process.cwd(), "data", "feedback_aliases");

function aliasFilePath(family: string, docType: string): string {
  return path.join(baseDir, family, `${docType}.json`);
}

async function safeReadAliasStore(filePath: string): Promise<AliasStore | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as AliasStore;
    return {
      labels: Array.isArray(parsed.labels) ? parsed.labels : [],
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    };
  } catch {
    return null;
  }
}

async function writeAliasStore(family: string, docType: string, store: AliasStore): Promise<void> {
  const filePath = aliasFilePath(family, docType);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
}

function buildMap(items: AliasItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    if (!item.enabled) continue;
    out[normalizeLabel(item.from)] = item.to;
  }
  return out;
}

function aggregateAliasItems(
  events: TemplateFeedbackEvent[],
  eventType: "FIELD_RELABEL" | "SECTION_RENAME"
): AliasItem[] {
  const counts = new Map<string, AliasItem>();
  for (const event of events) {
    if (event.eventType !== eventType) continue;
    if (!event.beforeValue?.trim() || !event.afterValue?.trim()) continue;
    const from = event.beforeValue.trim();
    const to = event.afterValue.trim();
    const key = `${normalizeLabel(from)}=>${normalizeLabel(to)}`;
    const prev = counts.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(key, { from, to, count: 1, enabled: true });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

async function buildFromFeedback(family: string, docType: string): Promise<AliasStore> {
  const docs = await listFeedbackEvents({ family, docType });
  const events: TemplateFeedbackEvent[] = [];
  for (const doc of docs) {
    const list = await getFeedbackEvents({ family, docType, docId: doc.docId });
    events.push(...list);
  }
  return {
    labels: aggregateAliasItems(events, "FIELD_RELABEL"),
    sections: aggregateAliasItems(events, "SECTION_RENAME"),
  };
}

export async function buildAliasMap(input: {
  family: string;
  docType: string;
}): Promise<AliasMapResult> {
  const filePath = aliasFilePath(input.family, input.docType);
  const stored = await safeReadAliasStore(filePath);
  const source: "repository" | "feedback" = stored ? "repository" : "feedback";
  const store = stored ?? (await buildFromFeedback(input.family, input.docType));
  return {
    labels: store.labels,
    sections: store.sections,
    labelAliasMap: buildMap(store.labels),
    sectionAliasMap: buildMap(store.sections),
    source,
  };
}

export async function toggleAlias(input: {
  family: string;
  docType: string;
  type: "label" | "section";
  from: string;
  to: string;
  enabled: boolean;
}): Promise<AliasStore> {
  const current = await buildAliasMap({ family: input.family, docType: input.docType });
  const store: AliasStore = {
    labels: [...current.labels],
    sections: [...current.sections],
  };
  const target = input.type === "label" ? store.labels : store.sections;
  const idx = target.findIndex(
    (item) =>
      normalizeLabel(item.from) === normalizeLabel(input.from) &&
      normalizeLabel(item.to) === normalizeLabel(input.to)
  );
  if (idx >= 0) {
    target[idx] = { ...target[idx], enabled: input.enabled };
  } else {
    target.push({
      from: input.from,
      to: input.to,
      count: 1,
      enabled: input.enabled,
    });
  }
  await writeAliasStore(input.family, input.docType, store);
  return store;
}
