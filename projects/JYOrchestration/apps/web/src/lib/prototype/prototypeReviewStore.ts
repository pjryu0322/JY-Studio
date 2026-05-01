/**
 * 프로토타입 검토 대화 — 파일 기반(.data/prototype-review). DB 마이그레이션 없음.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type PrototypeReviewRole = "user" | "expert" | "planner";

export type PrototypeReviewMessage = Readonly<{
  id: string;
  role: PrototypeReviewRole;
  content: string;
  createdAt: string;
}>;

export type PrototypeImprovementItem = Readonly<{
  title: string;
  detail: string;
}>;

type ReviewThread = {
  messages: PrototypeReviewMessage[];
  improvementItems: PrototypeImprovementItem[] | null;
};

type FileEnvelope = {
  threads: Record<string, ReviewThread>;
};

function dataDir(): string {
  return join(process.cwd(), ".data", "prototype-review");
}

function filePath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(dataDir(), `${safe}.json`);
}

function emptyEnvelope(): FileEnvelope {
  return { threads: {} };
}

function loadEnvelope(projectId: string): FileEnvelope {
  const p = filePath(projectId);
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileEnvelope>;
    if (!parsed || typeof parsed.threads !== "object" || parsed.threads === null) return emptyEnvelope();
    const threads: Record<string, ReviewThread> = {};
    for (const [runId, t] of Object.entries(parsed.threads)) {
      const msgRaw = (t as { messages?: unknown })?.messages;
      const messages: PrototypeReviewMessage[] = Array.isArray(msgRaw)
        ? msgRaw
            .map((m) => {
              const o = m as Record<string, unknown>;
              const id = String(o?.id ?? "").trim() || randomUUID();
              const role: PrototypeReviewRole =
                o?.role === "expert" || o?.role === "planner" || o?.role === "user" ? (o.role as PrototypeReviewRole) : "user";
              const content = String(o?.content ?? "");
              const createdAt = String(o?.createdAt ?? new Date().toISOString());
              return { id, role, content, createdAt };
            })
            .filter((m) => m.content.trim())
        : [];
      const imp = (t as { improvementItems?: unknown })?.improvementItems;
      const improvementItems =
        Array.isArray(imp) && imp.length
          ? imp
              .map((it) => {
                const o = it as Record<string, unknown>;
                return {
                  title: String(o?.title ?? "").trim(),
                  detail: String(o?.detail ?? "").trim(),
                };
              })
              .filter((it) => it.title)
          : null;
      threads[runId] = { messages, improvementItems: improvementItems?.length ? improvementItems : null };
    }
    return { threads };
  } catch {
    return emptyEnvelope();
  }
}

function saveEnvelope(projectId: string, env: FileEnvelope): void {
  const p = filePath(projectId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(env, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureThread(env: FileEnvelope, runId: string): ReviewThread {
  if (!env.threads[runId]) {
    env.threads[runId] = { messages: [], improvementItems: null };
  }
  return env.threads[runId];
}

export function getReviewThread(projectId: string, runId: string): PrototypeReviewMessage[] {
  const env = loadEnvelope(projectId);
  return env.threads[runId]?.messages ?? [];
}

export function getImprovementItems(projectId: string, runId: string): PrototypeImprovementItem[] | null {
  const env = loadEnvelope(projectId);
  const t = env.threads[runId];
  return t?.improvementItems && t.improvementItems.length ? t.improvementItems : null;
}

export function appendReviewMessage(
  projectId: string,
  runId: string,
  role: PrototypeReviewRole,
  content: string,
): PrototypeReviewMessage {
  const env = loadEnvelope(projectId);
  const thread = ensureThread(env, runId);
  const msg: PrototypeReviewMessage = {
    id: randomUUID(),
    role,
    content: content.trim(),
    createdAt: nowIso(),
  };
  thread.messages.push(msg);
  saveEnvelope(projectId, env);
  return msg;
}

export function setImprovementItems(
  projectId: string,
  runId: string,
  items: readonly PrototypeImprovementItem[],
): void {
  const env = loadEnvelope(projectId);
  const thread = ensureThread(env, runId);
  thread.improvementItems = items.length ? [...items] : null;
  saveEnvelope(projectId, env);
}
