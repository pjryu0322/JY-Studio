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

/** 정리 요청 등에서 생성하는 단일 통합 기획안(내부에 섹션 포함). */
export const IDEATION_UNIFIED_PROPOSAL_OUTPUT: readonly IdeationDeliverableType[] = ["full_plan"] as const;

export const IDEATION_DELIVERABLE_LABELS: Record<IdeationDeliverableType, string> = {
  meeting_summary: "회의 요약",
  problem_statement: "문제정의서",
  feature_list: "기능 목록",
  mvp_scope: "MVP 범위",
  kpi: "KPI",
  full_plan: "프로젝트 기획안",
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

  full_plan: `통합 기획안(단일 마크다운 문서 — 사용자에게는 파일 하나로 보이게):
반드시 아래 "##" 제목을 그대로 사용하고, 각 절 아래에 실무형 본문을 작성한다.
본문 1~6절이 곧 내부 첨부(부록) 역할을 한다: 각 절은 독립적으로 읽혀도 되도록 소제목·불릿을 갖춘다.

## 1. 문제정의
- 핵심 사용자, 현재 문제, 기존 방식, 개선 필요성

## 2. 기능목록
- 기능 후보명, 설명, 우선순위(또는 MoSCoW)

## 3. MVP 범위
- 반드시 포함 / 제외 / 후순위 를 명확히 구분

## 4. KPI
- 도입 후 성과 측정 지표, 측정 방식, 목표(초안)

## 5. 실행 로드맵
- 단계(예: 0~8주), 마일스톤, 의존성

## 6. 리스크 및 제약사항
- 기술·운영·규제·일정 리스크와 완화 방향

## 7. 부록 — 구조화 요약 (한눈에)
- 부록 A: 문제정의 요약(5줄 이내)
- 부록 B: 기능 목록 표(이름·설명·우선순위)
- 부록 C: MVP 포함/제외 표
- 부록 D: KPI·성공기준 표
- 부록 E: 로드맵 타임라인(주차 또는 단계)
- 부록 F: 리스크·제약 체크리스트

(선택) ## 8. 다음 액션
- 바로 착수할 일 3~5개`,
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
- 요청한 키는 빠지면 안 된다. 빈 문자열·공백만 있는 문자열 금지.
- 각 문자열은 실질적인 문서 본문이어야 한다(예: 문제정의서는 최소 수백 자 수준).`;
}

/** 모델이 마크다운 코드 펜스로 JSON을 감싼 경우 본문만 남긴다. */
export function stripJsonMarkdownFences(raw: string): string {
  let t = String(raw ?? "").trim();
  if (!t) return t;
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  return t;
}

const DELIVERABLE_OUTPUT_KEY_ALIASES: Record<IdeationDeliverableType, readonly string[]> = {
  meeting_summary: ["meetingSummary", "meeting-summary"],
  problem_statement: ["problemStatement", "problem-statement", "문제정의서", "문제_정의서", "problemDefinition"],
  feature_list: ["featureList", "feature-list", "features", "기능목록"],
  mvp_scope: ["mvpScope", "mvp-scope", "MVP범위"],
  kpi: ["KPI", "kpiMetrics"],
  full_plan: ["fullPlan", "full-plan", "plan", "전체기획안", "productPlan"],
};

function coerceDeliverableBodyText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    return v.replace(/\u200b/g, "").trim();
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v).trim();
  }
  if (Array.isArray(v)) {
    const parts = v.map(coerceDeliverableBodyText).filter((s) => s.length > 0);
    return parts.join("\n\n").trim();
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const key of ["content", "body", "markdown", "md", "text", "value", "본문", "문서"]) {
      if (Object.prototype.hasOwnProperty.call(o, key)) {
        const s = coerceDeliverableBodyText(o[key]);
        if (s) return s;
      }
    }
    return "";
  }
  return "";
}

/** outputs 객체에서 스네이크 케이스 키와 흔한 별칭으로 본문 문자열을 읽는다. */
export function readDeliverableOutputFromModel(outputsObj: unknown, type: IdeationDeliverableType): string {
  if (!outputsObj || typeof outputsObj !== "object") return "";
  const o = outputsObj as Record<string, unknown>;
  const keys = [type, ...(DELIVERABLE_OUTPUT_KEY_ALIASES[type] ?? [])];
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    const s = coerceDeliverableBodyText(o[k]);
    if (s.length > 0) return s;
  }
  return "";
}

/**
 * 파싱된 JSON 루트에서 outputs를 읽어 요청된 산출물만 추출한다.
 * 실패 시 어떤 키가 비었는지 message에 포함한다.
 */
export function extractIdeationDeliverableOutputsFromRoot(
  root: unknown,
  types: readonly IdeationDeliverableType[]
): { ok: true; outputs: Partial<Record<IdeationDeliverableType, string>> } | { ok: false; message: string } {
  if (!root || typeof root !== "object") {
    return { ok: false, message: "OpenAI 응답 스키마가 올바르지 않습니다." };
  }
  const outRaw = (root as Record<string, unknown>).outputs;
  if (!outRaw || typeof outRaw !== "object") {
    return { ok: false, message: 'OpenAI 응답에 "outputs" 객체가 없습니다.' };
  }
  const outputs: Partial<Record<IdeationDeliverableType, string>> = {};
  for (const t of types) {
    const s = readDeliverableOutputFromModel(outRaw, t);
    if (!s) {
      return { ok: false, message: `산출물 "${t}" 본문이 비어 있습니다.` };
    }
    outputs[t] = s;
  }
  return { ok: true, outputs };
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
  /** 제목 커스터마이즈(예: "{프로젝트명} 기획안 v3"). 미반환 시 기본 라벨 사용 */
  getAssetTitle?: (type: IdeationDeliverableType, version: number) => string | undefined;
}): { merged: IdeationDeliverableAsset[]; created: IdeationDeliverableAsset[] } {
  const base = [...(input.existing ?? [])];
  const created: IdeationDeliverableAsset[] = [];
  const now = new Date().toISOString();
  for (const t of input.typesRequested) {
    const content = String(input.outputs[t] ?? "").trim();
    if (!content) continue;
    const version = nextVersionForDeliverableType(base, t);
    const title = input.getAssetTitle?.(t, version)?.trim() || `${IDEATION_DELIVERABLE_LABELS[t]} v${version}`;
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
