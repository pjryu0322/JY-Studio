/**
 * 아이디어 협의실: 산출물(문서) 유형·프롬프트·채팅 카드 페이로드.
 */

export const IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE = "ideation-deliverable-result" as const;

/** API·저장용 키 */
export type IdeationDeliverableType =
  | "meeting_summary"
  | "problem_statement"
  | "feature_list"
  | "mvp_scope"
  | "kpi"
  | "full_plan";

export const IDEATION_DELIVERABLE_FULL_PLAN: IdeationDeliverableType = "full_plan";

export const IDEATION_DELIVERABLE_ORDER: readonly IdeationDeliverableType[] = [
  "meeting_summary",
  "problem_statement",
  "feature_list",
  "mvp_scope",
  "kpi",
  "full_plan",
] as const;

export const IDEATION_DELIVERABLE_LABELS: Record<IdeationDeliverableType, string> = {
  meeting_summary: "회의 요약",
  problem_statement: "문제정의서",
  feature_list: "기능 목록",
  mvp_scope: "MVP 범위",
  kpi: "KPI",
  full_plan: "전체 기획안",
};

export type IdeationDeliverableAsset = {
  id: string;
  projectId: string;
  type: IdeationDeliverableType;
  title: string;
  version: number;
  content: string;
  createdAt: string;
  confirmedAt?: string | null;
};

export type IdeationDeliverableChatPayload = {
  kind: typeof IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE;
  mode: "single" | "batch";
  headline: string;
  requestedTypes: IdeationDeliverableType[];
  items: Array<{
    assetId: string;
    type: IdeationDeliverableType;
    title: string;
    version: number;
    previewLines: string[];
  }>;
};

const OUTPUT_SPECS: Record<IdeationDeliverableType, string> = {
  meeting_summary: `회의 요약:
1. 핵심 논의사항
2. 합의 내용
3. 미결정 사항
4. 다음 액션`,

  problem_statement: `문제정의서:
1. 핵심 사용자
2. 현재 문제 상황
3. 기존 해결 방식
4. 왜 해결이 필요한가
5. 문제정의 문장`,

  feature_list: `기능 목록:
1. 기능명
2. 설명
3. 우선순위
4. 예상 화면`,

  mvp_scope: `MVP 범위:
1. 필수 기능
2. 선택 기능
3. 제외 기능
4. 출시 판단 기준`,

  kpi: `KPI:
1. KPI 항목
2. 측정 방식
3. 목표 수치(초안)
4. 우선순위`,

  full_plan: `전체 기획안:
1. 프로젝트 개요
2. 문제정의
3. 사용자 정의
4. 핵심 가치
5. 기능 목록
6. KPI
7. MVP 범위
8. 다음 단계 제안`,
};

export function isIdeationDeliverableType(v: unknown): v is IdeationDeliverableType {
  return typeof v === "string" && (IDEATION_DELIVERABLE_ORDER as readonly string[]).includes(v);
}

export function buildIdeationDeliverableBasePrompt(input: {
  projectName: string;
  projectDescription: string;
  chatSummary: string;
  recentMessages: string;
}): string {
  return `당신은 프로젝트 회의에 참여 중인 AI기획자입니다.

프로젝트명: ${input.projectName}
프로젝트 설명: ${input.projectDescription}

회의 요약:
${input.chatSummary}

최근 대화:
${input.recentMessages}

지시사항:
1. 회의 내용을 근거로 작성하라.
2. 추측하지 말고 대화 기반으로 작성하라.
3. 부족한 정보는 추가 확인 필요사항으로 표시하라.
4. 실무형 문서 형태로 간결하게 작성하라.
5. 중복 제거하라.`;
}

export function buildIdeationDeliverablesUserPrompt(selected: readonly IdeationDeliverableType[]): string {
  const parts = selected.map((t) => OUTPUT_SPECS[t]).filter(Boolean);
  const keys = selected.map((t) => `"${t}"`).join(", ");
  return `${parts.join("\n\n----------------------\n\n")}

[출력 형식 — 반드시 준수]
- JSON 객체 하나만 출력한다. 마크다운 펜스 금지.
- 최상위 키는 반드시 "outputs" 이다.
- "outputs" 값은 객체이며, 다음 키만 포함한다: ${keys}
- 각 값은 해당 산출물 전체 본문(마크다운 허용) 문자열이다.
- 요청한 키는 빠지면 안 된다. 빈 문자열 금지.`;
}

export function parseIdeationDeliverableChatPayload(raw: string): IdeationDeliverableChatPayload | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("{")) return null;
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    if (o.kind !== IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE) return null;
    const mode = o.mode === "batch" || o.mode === "single" ? o.mode : null;
    const headline = typeof o.headline === "string" ? o.headline.trim() : "";
    const requestedTypesRaw = Array.isArray(o.requestedTypes) ? o.requestedTypes : [];
    const requestedTypes = requestedTypesRaw.filter(isIdeationDeliverableType);
    const itemsRaw = Array.isArray(o.items) ? o.items : [];
    const items: IdeationDeliverableChatPayload["items"] = [];
    for (const row of itemsRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const assetId = typeof r.assetId === "string" ? r.assetId.trim() : "";
      const type = isIdeationDeliverableType(r.type) ? r.type : null;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const version = typeof r.version === "number" && Number.isFinite(r.version) ? Math.floor(r.version) : 0;
      const pl = Array.isArray(r.previewLines) ? r.previewLines.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
      if (!assetId || !type || !title || version < 1) continue;
      items.push({ assetId, type, title, version, previewLines: pl.slice(0, 6) });
    }
    if (!mode || !headline || !items.length) return null;
    return { kind: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE, mode, headline, requestedTypes, items };
  } catch {
    return null;
  }
}

export function extractPreviewLinesFromMarkdown(content: string, maxLines = 3): string[] {
  const lines = String(content ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s>*#-]+/, "").trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    if (line.length > 160) out.push(`${line.slice(0, 157)}…`);
    else out.push(line);
    if (out.length >= maxLines) break;
  }
  return out;
}

export function nextVersionForDeliverableType(assets: readonly IdeationDeliverableAsset[] | undefined, type: IdeationDeliverableType): number {
  const list = (assets ?? []).filter((a) => a.type === type);
  if (!list.length) return 1;
  return Math.max(...list.map((a) => a.version)) + 1;
}

export function appendIdeationDeliverableAssets(input: {
  projectId: string;
  existing: readonly IdeationDeliverableAsset[] | undefined;
  outputs: Partial<Record<IdeationDeliverableType, string>>;
  typesRequested: readonly IdeationDeliverableType[];
}): { merged: IdeationDeliverableAsset[]; created: IdeationDeliverableAsset[] } {
  const base = [...(input.existing ?? [])];
  const created: IdeationDeliverableAsset[] = [];
  const now = new Date().toISOString();
  for (const t of input.typesRequested) {
    const content = String(input.outputs[t] ?? "").trim();
    if (!content) continue;
    const version = nextVersionForDeliverableType(base, t);
    const title = `${IDEATION_DELIVERABLE_LABELS[t]} v${version}`;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const row: IdeationDeliverableAsset = {
      id,
      projectId: input.projectId,
      type: t,
      title,
      version,
      content,
      createdAt: now,
    };
    base.push(row);
    created.push(row);
  }
  return { merged: base, created };
}

export function markDeliverableAssetsConfirmed(
  assets: readonly IdeationDeliverableAsset[] | undefined,
  ids: readonly string[]
): IdeationDeliverableAsset[] {
  const idSet = new Set(ids.map((x) => String(x).trim()).filter(Boolean));
  const now = new Date().toISOString();
  return (assets ?? []).map((a) => (idSet.has(a.id) ? { ...a, confirmedAt: now } : a));
}

export function parseDeliverableAssetsFromState(raw: unknown): IdeationDeliverableAsset[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: IdeationDeliverableAsset[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const projectId = typeof o.projectId === "string" ? o.projectId.trim() : "";
    const type = isIdeationDeliverableType(o.type) ? o.type : null;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const version = typeof o.version === "number" && Number.isFinite(o.version) ? Math.floor(o.version) : 0;
    const content = typeof o.content === "string" ? o.content : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
    if (!id || !type || !title || version < 1 || !createdAt) continue;
    let confirmedAt: string | null | undefined;
    if ("confirmedAt" in o) {
      if (o.confirmedAt === null) confirmedAt = null;
      else if (typeof o.confirmedAt === "string" && o.confirmedAt.trim()) confirmedAt = o.confirmedAt.trim();
    }
    const asset: IdeationDeliverableAsset = {
      id,
      projectId: projectId || "",
      type,
      title,
      version,
      content,
      createdAt,
    };
    if (confirmedAt !== undefined) asset.confirmedAt = confirmedAt;
    out.push(asset);
  }
  return out.length ? out : undefined;
}
