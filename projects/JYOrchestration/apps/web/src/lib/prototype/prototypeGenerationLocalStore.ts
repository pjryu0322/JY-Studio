/**
 * 프로토타입 생성 워크스페이스의 브라우저 로컬 상태 (서버/DB 없이 Cursor 수동 루프 지원).
 */

export type PrototypeGenerationRunStatus = "idle" | "prompt_ready" | "awaiting_preview" | "preview_ready" | "failed";

export type PrototypeWorkspaceChatLine = Readonly<{
  id: string;
  text: string;
  at: number;
  replyToId?: string | null;
  replyContextLine?: string | null;
}>;

export type PrototypeGenerationLocalRecord = Readonly<{
  selectedTemplate: string | null;
  /** 콤보에서 [확정]까지 눌러 템플릿이 확정된 경우 true (AI 추천만 써도 확정 시 true) */
  templateCommittedToPlan?: boolean;
  previewUrl: string | null;
  /** 마지막 "생성 요청" 시점의 설계 지문 */
  fingerprintAtRequest: string | null;
  lastRequestedAt: string | null;
  runStatus: PrototypeGenerationRunStatus;
  lastError: string | null;
  proceedWithGaps: boolean;
  lastPromptSnapshot: string | null;
  /** 채팅(사용자 입력) — 새로고침 후에도 유지 */
  chatUserLog: readonly PrototypeWorkspaceChatLine[];
  /** 채팅(시스템/AI 안내) — 새로고침 후에도 유지 */
  chatAiLog: readonly PrototypeWorkspaceChatLine[];
}>;

const defaultRecord: PrototypeGenerationLocalRecord = {
  selectedTemplate: null,
  templateCommittedToPlan: false,
  previewUrl: null,
  fingerprintAtRequest: null,
  lastRequestedAt: null,
  runStatus: "idle",
  lastError: null,
  proceedWithGaps: false,
  lastPromptSnapshot: null,
  chatUserLog: [],
  chatAiLog: [],
};

export function defaultPrototypeGenerationRecord(): PrototypeGenerationLocalRecord {
  return defaultRecord;
}

function storageKey(projectId: string): string {
  return `jy_orchestration_prototype_workspace:${projectId.trim()}`;
}

export function computeDesignFingerprint(parts: {
  readonly flowFingerprint: string;
  readonly ideationFingerprint: string;
  readonly featureTitlesFingerprint: string;
}): string {
  return [parts.flowFingerprint, parts.ideationFingerprint, parts.featureTitlesFingerprint].join("|");
}

export function buildFlowFingerprintJson(
  flow: {
    readonly actors: readonly { id: string; name: string; kind: string }[];
    readonly steps: readonly { id: string; title: string; primaryActorId: string; order: number }[];
  } | null,
): string {
  if (!flow?.actors || !flow?.steps) return "";
  const actors = [...flow.actors].map((a) => ({ id: a.id, name: a.name, k: a.kind })).sort((a, b) => a.id.localeCompare(b.id));
  const steps = [...flow.steps]
    .map((s) => ({ id: s.id, t: s.title, p: s.primaryActorId, o: s.order }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ actors, steps });
}

export function buildIdeationFingerprint(assets: ReadonlyArray<{ title?: string; content?: string }>): string {
  const parts = assets.map((a) => `${String(a.title ?? "").slice(0, 80)}:${String(a.content ?? "").slice(0, 120)}`);
  return parts.join("¦");
}

export function loadPrototypeGenerationRecord(projectId: string): PrototypeGenerationLocalRecord {
  if (typeof window === "undefined") return defaultRecord;
  try {
    const raw = window.sessionStorage.getItem(storageKey(projectId));
    if (!raw) return defaultRecord;
    const o = JSON.parse(raw) as Partial<PrototypeGenerationLocalRecord>;
    const normalizeChat = (v: unknown): PrototypeWorkspaceChatLine[] => {
      if (!Array.isArray(v)) return [];
      const out: PrototypeWorkspaceChatLine[] = [];
      for (const it of v) {
        const r = it as Partial<PrototypeWorkspaceChatLine>;
        const id = typeof r.id === "string" ? r.id : "";
        const text = typeof r.text === "string" ? r.text : "";
        const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
        if (!id || !text || !at) continue;
        const replyToId = typeof r.replyToId === "string" && r.replyToId.trim() ? r.replyToId.trim() : null;
        const replyContextLine =
          typeof r.replyContextLine === "string" && r.replyContextLine.trim() ? r.replyContextLine.trim().slice(0, 200) : null;
        out.push({ id, text: text.slice(0, 8000), at, replyToId, replyContextLine });
      }
      out.sort((a, b) => a.at - b.at);
      return out.slice(-200);
    };
    return {
      ...defaultRecord,
      ...o,
      selectedTemplate: typeof o.selectedTemplate === "string" ? o.selectedTemplate : null,
      templateCommittedToPlan: o.templateCommittedToPlan === true,
      previewUrl: typeof o.previewUrl === "string" ? o.previewUrl : null,
      fingerprintAtRequest: typeof o.fingerprintAtRequest === "string" ? o.fingerprintAtRequest : null,
      lastRequestedAt: typeof o.lastRequestedAt === "string" ? o.lastRequestedAt : null,
      runStatus: (o.runStatus as PrototypeGenerationRunStatus) ?? "idle",
      lastError: typeof o.lastError === "string" ? o.lastError : null,
      proceedWithGaps: Boolean(o.proceedWithGaps),
      lastPromptSnapshot: typeof o.lastPromptSnapshot === "string" ? o.lastPromptSnapshot : null,
      chatUserLog: normalizeChat((o as any).chatUserLog),
      chatAiLog: normalizeChat((o as any).chatAiLog),
    };
  } catch {
    return defaultRecord;
  }
}

export function savePrototypeGenerationRecord(projectId: string, patch: Partial<PrototypeGenerationLocalRecord>): void {
  if (typeof window === "undefined") return;
  const prev = loadPrototypeGenerationRecord(projectId);
  const next = { ...prev, ...patch };
  try {
    window.sessionStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
